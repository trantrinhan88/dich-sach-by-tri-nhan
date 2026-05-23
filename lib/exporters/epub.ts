import JSZip from 'jszip'
import { DocumentBlock } from '../types'
import { renderCefrHTML, CEFR_CSS } from './cefr'

export async function exportEPUB(blocks: DocumentBlock[], title: string, bilingual = false): Promise<Buffer> {
  const zip = new JSZip()
  const safeTitle = title.replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c)
  )

  // mimetype must be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )

  const hasCefr = blocks.some(b => b.cefrAnnotatedTranslation || b.cefrAnnotatedOriginal)

  const bilingualCSS = bilingual ? `
.en-text {
  color: #777;
  font-size: 12pt;
  font-style: italic;
  margin: 0.6em 0 0.1em;
  text-indent: 0;
  line-height: 1.6;
}
.vi-text {
  margin: 0 0 0.8em;
  text-indent: 1.2cm;
}` : ''

  const cefrCSS = hasCefr ? CEFR_CSS : ''

  // CSS
  zip.file(
    'OEBPS/style.css',
    `@import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap');

body {
  font-family: 'Bookerly', 'Literata', 'Georgia', serif;
  font-size: 14pt;
  line-height: 1.8;
  color: #000000;
  margin-top: 2cm;
  margin-bottom: 2cm;
  margin-left: 3cm;
  margin-right: 2cm;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Bookerly', 'Literata', 'Georgia', serif;
  font-weight: bold;
  font-style: normal;
  text-align: left;
  margin: 1.5em 0 0.5em;
  text-indent: 0;
  page-break-after: avoid;
}
h1 { font-size: 20pt; font-weight: 700; }
h2 { font-size: 17pt; font-weight: 700; }
h3 { font-size: 15pt; font-weight: 700; }
h4 { font-size: 14pt; font-weight: 700; }
h5 { font-size: 14pt; font-weight: 700; }
h6 { font-size: 14pt; font-weight: 700; }

p {
  margin: 0;
  text-align: justify;
  text-indent: 1.2cm;
  line-height: 1.8;
}

li {
  font-size: 14pt;
  margin: 0.3em 0;
  text-align: justify;
}

pre, code {
  font-family: 'Courier New', monospace;
  font-size: 11pt;
  background: #f5f5f5;
  padding: 0.2em 0.4em;
}
pre { display: block; padding: 1em; white-space: pre-wrap; text-indent: 0; }

td, th {
  font-size: 14pt;
  border: 1px solid #000;
  padding: 0.4em 0.6em;
  text-align: left;
}
table { border-collapse: collapse; width: 100%; margin: 1em 0; }

em { font-style: italic; }
strong { font-weight: bold; }
${bilingualCSS}${cefrCSS}`
  )

  // Build content HTML
  const contentHTML = buildContentHTML(blocks, safeTitle, bilingual)
  zip.file('OEBPS/content.xhtml', contentHTML)

  // content.opf
  const now = new Date().toISOString().slice(0, 10)
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${safeTitle}</dc:title>
    <dc:language>vi</dc:language>
    <dc:date>${now}</dc:date>
    <dc:identifier id="BookId">urn:uuid:${randomId()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="content"/>
  </spine>
</package>`
  )

  // toc.ncx
  const headings = blocks.filter(b => b.type === 'heading' && (b.style.level || 1) <= 2)
  const navPoints = headings
    .slice(0, 30)
    .map(
      (h, i) =>
        `    <navPoint id="nav${i}" playOrder="${i + 1}">
      <navLabel><text>${esc(h.translatedText || h.originalText)}</text></navLabel>
      <content src="content.xhtml#block-${h.id}"/>
    </navPoint>`
    )
    .join('\n')

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${randomId()}"/></head>
  <docTitle><text>${safeTitle}</text></docTitle>
  <navMap>
${navPoints || `    <navPoint id="nav0" playOrder="1"><navLabel><text>${safeTitle}</text></navLabel><content src="content.xhtml"/></navPoint>`}
  </navMap>
</ncx>`
  )

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return buffer
}

function buildContentHTML(blocks: DocumentBlock[], title: string, bilingual: boolean): string {
  const body = blocks
    .map(block => {
      const rawVi = block.translatedText || block.originalText
      const vi = block.cefrAnnotatedTranslation
        ? renderCefrHTML(esc(block.cefrAnnotatedTranslation))
        : esc(rawVi)
      const en = block.cefrAnnotatedOriginal
        ? renderCefrHTML(esc(block.cefrAnnotatedOriginal))
        : esc(block.originalText)

      switch (block.type) {
        case 'heading': {
          const lvl = Math.min(block.style.level || 1, 6)
          if (bilingual && block.translatedText) {
            return `<h${lvl} id="block-${block.id}">${vi}</h${lvl}>\n  <p class="en-text">${en}</p>`
          }
          return `<h${lvl} id="block-${block.id}">${vi}</h${lvl}>`
        }
        case 'list-item':
          return `<li>${vi}</li>`
        case 'table-cell':
          return `<td>${vi}</td>`
        case 'caption':
          return `<p><em>${vi}</em></p>`
        case 'code':
          return `<pre><code>${esc(block.originalText)}</code></pre>`
        default:
          if (bilingual && block.translatedText) {
            return `<p class="en-text">${en}</p>\n  <p class="vi-text">${vi}</p>`
          }
          return block.style.fontWeight === 'bold'
            ? `<p><strong>${vi}</strong></p>`
            : `<p>${vi}</p>`
      }
    })
    .join('\n  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">
<head>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  ${body}
</body>
</html>`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
