import { DocumentBlock } from '../types'
import { getFont } from '../fonts'
import fs from 'fs/promises'

// 1cm = 28.3465pt
const CM = 28.3465
const MARGIN_LEFT = 3 * CM    // 3cm lề trái
const MARGIN_OTHER = 2 * CM   // 2cm lề phải / trên / dưới
const BODY_SIZE = 14           // 14pt
const FIRST_LINE_INDENT = 1.2 * CM  // thụt đầu dòng 1.2cm

async function trySystemFont(fontPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(fontPath)
  } catch {
    return null
  }
}

export async function exportPDF(blocks: DocumentBlock[], title: string, bilingual = false): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit')

  // Ưu tiên Times New Roman hệ thống (hỗ trợ tiếng Việt trên Windows)
  const timesReg = await trySystemFont('C:\\Windows\\Fonts\\times.ttf')
  const timesBold = await trySystemFont('C:\\Windows\\Fonts\\timesbd.ttf')

  let regularFontName: string
  let boldFontName: string
  let regularBuf: Buffer | null = null
  let boldBuf: Buffer | null = null

  if (timesReg && timesBold) {
    regularBuf = timesReg
    boldBuf = timesBold
    regularFontName = 'TimesRegular'
    boldFontName = 'TimesBold'
  } else {
    // Fallback: Noto Sans (có đầy đủ ký tự tiếng Việt)
    try {
      regularBuf = await getFont(false)
      boldBuf = await getFont(true)
      regularFontName = 'NotoRegular'
      boldFontName = 'NotoBold'
    } catch (err) {
      console.warn('Vietnamese font not available:', err)
      regularFontName = 'Times-Roman'
      boldFontName = 'Times-Bold'
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margins: {
        top: MARGIN_OTHER,
        bottom: MARGIN_OTHER,
        left: MARGIN_LEFT,
        right: MARGIN_OTHER,
      },
      size: 'A4',
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    if (regularBuf && boldBuf) {
      doc.registerFont(regularFontName, regularBuf)
      doc.registerFont(boldFontName, boldBuf)
    }

    const pageWidth = doc.page.width - MARGIN_LEFT - MARGIN_OTHER

    // Tiêu đề
    doc
      .font(boldFontName)
      .fontSize(BODY_SIZE + 6)
      .text(title, { align: 'center', width: pageWidth })
    doc.moveDown(1.5)

    for (const block of blocks) {
      const text = block.translatedText || block.originalText
      if (!text.trim()) continue

      switch (block.type) {
        case 'heading': {
          const level = block.style.level || 1
          const sizes = [20, 17, 15, 14, 14, 14]
          const size = sizes[Math.min(level - 1, 5)]
          doc.moveDown(0.8)
          doc.font(boldFontName).fontSize(size).text(text, { width: pageWidth })
          if (bilingual && block.translatedText && block.originalText !== text) {
            doc.fillColor('#888888').font(regularFontName).fontSize(size - 2)
              .text(block.originalText, { width: pageWidth })
            doc.fillColor('#000000')
          }
          doc.moveDown(0.4)
          break
        }

        case 'list-item': {
          const indentPt = 20 * (block.style.level || 1)
          doc
            .font(regularFontName)
            .fontSize(BODY_SIZE)
            .text(`• ${text}`, { indent: indentPt, width: pageWidth - indentPt })
          doc.moveDown(0.1)
          break
        }

        case 'table-cell': {
          doc
            .font(regularFontName)
            .fontSize(BODY_SIZE - 1)
            .text(`| ${text}`, { width: pageWidth })
          break
        }

        case 'code': {
          doc.moveDown(0.3)
          doc.font('Courier').fontSize(10).text(block.originalText, {
            width: pageWidth,
            lineBreak: true,
          })
          doc.moveDown(0.3)
          break
        }

        case 'caption': {
          if (bilingual && block.translatedText) {
            doc.fillColor('#888888').font(regularFontName).fontSize(BODY_SIZE - 3)
              .text(block.originalText, { width: pageWidth, align: 'center' })
            doc.fillColor('#000000')
          }
          doc
            .font(regularFontName)
            .fontSize(BODY_SIZE - 2)
            .text(text, { width: pageWidth, align: 'center' })
          doc.moveDown(0.2)
          break
        }

        default: {
          // Bilingual: English original (gray, italic) then Vietnamese
          if (bilingual && block.translatedText) {
            doc.fillColor('#777777').font(regularFontName).fontSize(BODY_SIZE - 1)
              .text(block.originalText, { width: pageWidth, lineBreak: true })
            doc.fillColor('#000000')
          }
          const isBold = block.style.fontWeight === 'bold'
          doc
            .font(isBold ? boldFontName : regularFontName)
            .fontSize(BODY_SIZE)
            .text(text, {
              width: pageWidth,
              align: isBold ? 'left' : 'justify',
              indent: isBold ? 0 : FIRST_LINE_INDENT,
              lineBreak: true,
            })
          doc.moveDown(isBold ? 0.4 : 0.2)
          break
        }
      }
    }

    doc.end()
  })
}
