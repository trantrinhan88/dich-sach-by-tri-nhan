import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableCell,
  TableRow,
  Table,
  WidthType,
  BorderStyle,
  convertMillimetersToTwip,
} from 'docx'
import { DocumentBlock } from '../types'

// Page margins: left 3cm, right/top/bottom 2cm
const MARGIN_LEFT = convertMillimetersToTwip(30)
const MARGIN_OTHER = convertMillimetersToTwip(20)

// First-line indent: 1.2cm
const FIRST_LINE_INDENT = convertMillimetersToTwip(12)

// Font size: 14pt → half-points = 28
const BODY_SIZE = 28
const FONT = 'Times New Roman'

export async function exportDOCX(blocks: DocumentBlock[], title: string, bilingual = false): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // Title paragraph
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title, font: FONT, size: BODY_SIZE + 8, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    const text = block.translatedText || block.originalText

    switch (block.type) {
      case 'heading': {
        const lvlMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        }
        const level = block.style.level || 1
        const headingSize = Math.max(BODY_SIZE, BODY_SIZE + (7 - level) * 2)
        children.push(
          new Paragraph({
            children: [new TextRun({ text, font: FONT, size: headingSize, bold: true })],
            heading: lvlMap[level] || HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        )
        // Bilingual: English heading in gray below
        if (bilingual && block.translatedText) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: block.originalText, font: FONT, size: headingSize - 4, color: '888888', italics: true })],
              spacing: { after: 120 },
            })
          )
        }
        i++
        break
      }

      case 'list-item': {
        children.push(
          new Paragraph({
            children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
            bullet: { level: Math.max(0, (block.style.level || 1) - 1) },
            spacing: { after: 60 },
          })
        )
        i++
        break
      }

      case 'table-cell': {
        const cellTexts: string[] = [text]
        let j = i + 1
        while (j < blocks.length && blocks[j].type === 'table-cell') {
          cellTexts.push(blocks[j].translatedText || blocks[j].originalText)
          j++
        }
        const COLS = Math.min(cellTexts.length, 4)
        const rows: TableRow[] = []
        for (let r = 0; r < cellTexts.length; r += COLS) {
          const rowCells = cellTexts.slice(r, r + COLS).map(
            ct =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: ct, font: FONT, size: BODY_SIZE })],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 },
                },
              })
          )
          rows.push(new TableRow({ children: rowCells }))
        }
        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        )
        i = j
        break
      }

      case 'code': {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.originalText,
                font: 'Courier New',
                size: BODY_SIZE - 4,
                color: '333333',
              }),
            ],
            spacing: { before: 120, after: 120 },
            alignment: AlignmentType.LEFT,
          })
        )
        i++
        break
      }

      default: {
        // Bilingual: English (gray, italic) then Vietnamese (normal)
        if (bilingual && block.translatedText) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: block.originalText, font: FONT, size: BODY_SIZE - 2, color: '777777', italics: true })],
              spacing: { after: 40 },
              alignment: AlignmentType.LEFT,
            })
          )
        }
        children.push(
          new Paragraph({
            children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
            spacing: { after: 0, line: 276, lineRule: 'auto' },
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: FIRST_LINE_INDENT },
          })
        )
        i++
        break
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: '000000' },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_OTHER,
              bottom: MARGIN_OTHER,
              left: MARGIN_LEFT,
              right: MARGIN_OTHER,
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBuffer(doc)
}
