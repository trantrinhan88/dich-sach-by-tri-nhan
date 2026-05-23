import JSZip from 'jszip'
import * as cheerio from 'cheerio'
import { DocumentBlock, BlockType, BlockStyle } from '../types'
import { randomUUID } from 'crypto'

export async function parseEPUB(buffer: ArrayBuffer): Promise<{
  blocks: DocumentBlock[]
  pageCount: number
}> {
  const zip = await JSZip.loadAsync(buffer)

  // Read container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new Error('Invalid EPUB: missing META-INF/container.xml')

  const $container = cheerio.load(containerXml, { xmlMode: true })
  const opfPath = $container('rootfile').attr('full-path') || 'content.opf'
  const basePath = opfPath.includes('/')
    ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1)
    : ''

  // Read content.opf
  const opfContent = await zip.file(opfPath)?.async('string')
  if (!opfContent) throw new Error('Invalid EPUB: missing content.opf')

  const $opf = cheerio.load(opfContent, { xmlMode: true })

  // Build manifest
  const manifest: Record<string, { href: string; mediaType: string }> = {}
  $opf('manifest item').each((_, el) => {
    const id = $opf(el).attr('id')
    const href = $opf(el).attr('href')
    const mediaType = $opf(el).attr('media-type') || ''
    if (id && href) manifest[id] = { href, mediaType }
  })

  // Get spine order
  const spineItems: string[] = []
  $opf('spine itemref').each((_, el) => {
    const idref = $opf(el).attr('idref')
    if (idref && manifest[idref]) {
      spineItems.push(manifest[idref].href)
    }
  })

  const blocks: DocumentBlock[] = []

  for (const href of spineItems) {
    const fullPath = basePath + href
    const html = await zip.file(fullPath)?.async('string')
      || await zip.file(href)?.async('string') // fallback without basePath
    if (!html) continue

    const chapterBlocks = parseHTMLChapter(html, href)
    blocks.push(...chapterBlocks)
  }

  return { blocks, pageCount: spineItems.length }
}

function parseHTMLChapter(html: string, chapterHref: string): DocumentBlock[] {
  const $ = cheerio.load(html)
  const blocks: DocumentBlock[] = []

  const rawBlocks: {
    type: BlockType
    text: string
    style: BlockStyle
    tag: string
    className: string
  }[] = []

  $('body')
    .find('h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,pre,code,blockquote')
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || 'p'
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (!text) return

      let type: BlockType = 'paragraph'
      let level: number | undefined

      const headingMatch = tag.match(/^h([1-6])$/)
      if (headingMatch) {
        type = 'heading'
        level = parseInt(headingMatch[1])
      } else if (tag === 'li') {
        type = 'list-item'
      } else if (tag === 'td' || tag === 'th') {
        type = 'table-cell'
      } else if (tag === 'figcaption') {
        type = 'caption'
      } else if (tag === 'pre' || tag === 'code') {
        type = 'code'
      }

      // Detect bold via inline style or entirely-bold child content
      const inlineStyle = $(el).attr('style') || ''
      const hasBoldStyle = /font-weight\s*:\s*(bold|[6-9]\d{2})/i.test(inlineStyle)
      const allContentBold =
        $(el).children().length > 0 &&
        $(el).children().toArray().every(c => ['b', 'strong'].includes(c.tagName?.toLowerCase() || ''))

      const style: BlockStyle = {
        level,
        fontWeight: (headingMatch || tag === 'th' || hasBoldStyle || allContentBold) ? 'bold' : 'normal',
      }

      rawBlocks.push({
        type,
        text,
        style,
        tag,
        className: $(el).attr('class') || '',
      })
    })

  let i = 0
  while (i < rawBlocks.length) {
    const current = rawBlocks[i]

    // Case 1: Paragraphs - <p class="en-text" or "en-para"> followed by <p class="vi-text" or "vi-para">
    if (
      current.type === 'paragraph' &&
      (current.className.includes('en-text') || current.className.includes('en-para')) &&
      i + 1 < rawBlocks.length &&
      rawBlocks[i + 1].type === 'paragraph' &&
      (rawBlocks[i + 1].className.includes('vi-text') || rawBlocks[i + 1].className.includes('vi-para'))
    ) {
      blocks.push({
        id: randomUUID(),
        type: 'paragraph',
        originalText: current.text,
        translatedText: rawBlocks[i + 1].text,
        style: current.style,
        metadata: { chapterHref, tag: current.tag },
      })
      i += 2
      continue
    }

    // Case 2: Headings - <h1-6> followed by <p class="en-text" or "en-heading"> (translated heading + original heading)
    if (
      current.type === 'heading' &&
      i + 1 < rawBlocks.length &&
      rawBlocks[i + 1].type === 'paragraph' &&
      (rawBlocks[i + 1].className.includes('en-text') || rawBlocks[i + 1].className.includes('en-heading'))
    ) {
      blocks.push({
        id: randomUUID(),
        type: 'heading',
        originalText: rawBlocks[i + 1].text,
        translatedText: current.text,
        style: current.style,
        metadata: { chapterHref, tag: current.tag },
      })
      i += 2
      continue
    }

    // Default Case: normal parse
    blocks.push({
      id: randomUUID(),
      type: current.type,
      originalText: current.text,
      translatedText: current.className.includes('vi-text') || current.className.includes('vi-para') ? current.text : undefined,
      style: current.style,
      metadata: { chapterHref, tag: current.tag },
    })
    i += 1
  }

  return blocks
}
