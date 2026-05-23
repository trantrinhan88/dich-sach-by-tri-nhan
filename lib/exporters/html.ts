import { DocumentBlock } from '../types'
import { renderCefrHTML, CEFR_CSS } from './cefr'

export function exportHTML(blocks: DocumentBlock[], title: string, bilingual = false): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const hasCefr = blocks.some(b => b.cefrAnnotatedTranslation || b.cefrAnnotatedOriginal)

  const body = blocks
    .map(block => {
      const rawVi = block.translatedText || block.originalText
      const vi = block.cefrAnnotatedTranslation
        ? renderCefrHTML(esc(block.cefrAnnotatedTranslation))
        : esc(rawVi)
      const en = block.cefrAnnotatedOriginal
        ? renderCefrHTML(esc(block.cefrAnnotatedOriginal))
        : esc(block.originalText)
      const isUntranslated = !block.translatedText

      switch (block.type) {
        case 'heading': {
          const lvl = Math.min(block.style.level || 1, 6)
          if (bilingual && block.translatedText) {
            return `<h${lvl}>${vi}</h${lvl}><p class="en-heading">${en}</p>`
          }
          return `<h${lvl} class="${isUntranslated ? 'untranslated' : ''}">${vi}</h${lvl}>`
        }
        case 'list-item':
          return `<li class="${isUntranslated ? 'untranslated' : ''}">${vi}</li>`
        case 'table-cell':
          return `<td class="${isUntranslated ? 'untranslated' : ''}">${vi}</td>`
        case 'caption':
          return `<figcaption class="${isUntranslated ? 'untranslated' : ''}">${vi}</figcaption>`
        case 'code':
          return `<pre><code>${esc(block.originalText)}</code></pre>`
        default:
          if (bilingual && block.translatedText) {
            return `<p class="en-para">${en}</p><p class="vi-para">${vi}</p>`
          }
          return `<p class="${isUntranslated ? 'untranslated' : ''}">${vi}</p>`
      }
    })
    .join('\n  ')

  const bilingualCSS = bilingual ? `
    .en-para { color: #666; font-size: 0.93em; margin: 0.8rem 0 0.1rem; font-style: italic; text-indent: 1.2cm; }
    .vi-para { margin: 0 0 1rem; }
    .en-heading { color: #999; font-size: 0.88em; margin: 0 0 0.5rem; font-style: italic; font-weight: normal; }` : ''

  const cefrCSS = hasCefr ? CEFR_CSS : ''

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Be Vietnam Pro', 'Noto Sans', sans-serif;
      font-size: 16px;
      line-height: 1.85;
      color: #1a1a2e;
      background: #fafafa;
      max-width: 820px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    h1 { font-size: 2.2em; margin: 1.8rem 0 0.8rem; }
    h2 { font-size: 1.8em; margin: 1.6rem 0 0.7rem; }
    h3 { font-size: 1.5em; margin: 1.4rem 0 0.6rem; }
    h4 { font-size: 1.25em; margin: 1.2rem 0 0.5rem; }
    h5, h6 { font-size: 1.1em; margin: 1rem 0 0.4rem; }
    p { margin: 0.4rem 0; text-indent: 1.2cm; }
    li { margin: 0.3rem 0 0.3rem 1.5rem; }
    td { border: 1px solid #d0d0d0; padding: 0.5rem 0.75rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    figcaption { font-size: 0.9em; color: #555; font-style: italic; margin: 0.4rem 0; }
    pre { background: #f3f4f6; padding: 1rem 1.25rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; text-indent: 0; }
    code { font-family: 'Courier New', monospace; font-size: 0.9em; }
    .untranslated { background: #fff3cd; outline: 2px dashed #ffc107; }${bilingualCSS}${cefrCSS}
    @media print {
      body { max-width: 100%; background: white; padding: 1cm 2cm; }
      .untranslated { background: none; outline: none; }
    }
  </style>
</head>
<body>
  ${body}
</html>`
}
