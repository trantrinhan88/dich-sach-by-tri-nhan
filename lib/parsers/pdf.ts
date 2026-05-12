import { DocumentBlock, BlockType, BlockStyle } from '../types'
import { randomUUID } from 'crypto'

interface TextItem {
  str: string
  transform: number[] // [scaleX, skewX, skewY, scaleY, x, y]
  width: number
  height: number
  fontName: string
}

export async function parsePDF(buffer: ArrayBuffer): Promise<{
  blocks: DocumentBlock[]
  pageCount: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')

  const pageItems: TextItem[][] = []
  let pageCount = 0

  await pdfParse(Buffer.from(buffer), {
    pagerender: async (pageData: { getTextContent: () => Promise<{ items: TextItem[] }> }) => {
      try {
        const content = await pageData.getTextContent()
        pageItems.push(content.items || [])
      } catch {
        pageItems.push([])
      }
      return ''
    },
  })

  pageCount = pageItems.length

  const blocks: DocumentBlock[] = []
  for (let i = 0; i < pageItems.length; i++) {
    const pageBlocks = processPageItems(pageItems[i], i + 1)
    blocks.push(...pageBlocks)
  }

  return { blocks, pageCount }
}

function processPageItems(items: TextItem[], pageNum: number): DocumentBlock[] {
  if (!items.length) return []

  // Sort top-to-bottom (PDF y=0 is bottom, so higher y = higher on page)
  const sorted = [...items]
    .filter(it => it.str.trim())
    .sort((a, b) => {
      const dy = b.transform[5] - a.transform[5]
      if (Math.abs(dy) > 3) return dy
      return a.transform[4] - b.transform[4]
    })

  if (!sorted.length) return []

  // Compute average font size for heading detection
  const fontSizes = sorted.map(it => Math.abs(it.transform[3])).filter(s => s > 0)
  const avgFontSize = fontSizes.length
    ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length
    : 12

  // Group into lines (items with similar y)
  const lines: TextItem[][] = []
  let currentLine: TextItem[] = [sorted[0]]
  let currentY = sorted[0].transform[5]

  for (let i = 1; i < sorted.length; i++) {
    const y = sorted[i].transform[5]
    if (Math.abs(y - currentY) <= 3) {
      currentLine.push(sorted[i])
    } else {
      lines.push([...currentLine])
      currentLine = [sorted[i]]
      currentY = y
    }
  }
  if (currentLine.length) lines.push(currentLine)

  // Group lines into blocks (gap detection)
  const blocks: DocumentBlock[] = []
  let paragraphLines: TextItem[][] = [lines[0]]

  for (let i = 1; i < lines.length; i++) {
    const prevY = paragraphLines[paragraphLines.length - 1][0].transform[5]
    const currY = lines[i][0].transform[5]
    const gap = Math.abs(prevY - currY)

    if (gap > avgFontSize * 1.8) {
      const block = linesToBlock(paragraphLines, pageNum, avgFontSize)
      if (block) blocks.push(block)
      paragraphLines = [lines[i]]
    } else {
      paragraphLines.push(lines[i])
    }
  }
  if (paragraphLines.length) {
    const block = linesToBlock(paragraphLines, pageNum, avgFontSize)
    if (block) blocks.push(block)
  }

  return blocks
}

function linesToBlock(lines: TextItem[][], pageNum: number, avgFontSize: number): DocumentBlock | null {
  const text = lines
    .map(line =>
      line
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(it => it.str)
        .join(' ')
    )
    .join('\n')
    .trim()

  if (!text) return null

  const allItems = lines.flat()
  const sizes = allItems.map(it => Math.abs(it.transform[3])).filter(s => s > 0)
  const fontSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : avgFontSize

  let type: BlockType = 'paragraph'
  let level: number | undefined

  if (fontSize >= avgFontSize * 1.45) {
    type = 'heading'
    level = fontSize >= avgFontSize * 2 ? 1 : fontSize >= avgFontSize * 1.7 ? 2 : 3
  } else if (/^[•‣◦⁃\-\*\►]\s/.test(text)) {
    type = 'list-item'
  } else if (/^\d+[)]\s/.test(text)) {
    // Only parenthesis-style (1) 2) ...) treated as list; dot-style (1. 2.1.) are section headings
    type = 'list-item'
  }

  // Detect bold via font size ratio OR bold font name (e.g. "TimesNewRomanPS-BoldMT", "Arial-BoldMT")
  const isBoldFont = allItems.some(it => /bold|[\-_]bd\b/i.test(it.fontName || ''))
  const style: BlockStyle = {
    fontSize,
    fontWeight: (fontSize >= avgFontSize * 1.3 || isBoldFont) ? 'bold' : 'normal',
    level,
  }

  const first = lines[0][0]
  return {
    id: randomUUID(),
    type,
    originalText: text,
    style,
    position: {
      page: pageNum,
      x: first.transform[4],
      y: first.transform[5],
      width: allItems.reduce((max, it) => Math.max(max, it.width), 0),
      height: fontSize,
    },
  }
}
