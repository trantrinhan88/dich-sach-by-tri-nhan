import { DocumentBlock } from '../types'
import { randomUUID } from 'crypto'

export async function parseSRT(buffer: ArrayBuffer): Promise<{
  blocks: DocumentBlock[]
  pageCount: number
}> {
  const text = new TextDecoder('utf-8').decode(buffer)
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // Split by double newlines (with optional whitespace)
  const rawBlocks = normalizedText.split(/\n\s*\n/)
  
  const blocks: DocumentBlock[] = []
  let srtIndex = 1
  
  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue
    
    let indexStr = lines[0]
    let timecodeLine = lines[1]
    let textStartIdx = 2
    
    // Check if the first line is actually a number. If not, maybe it's just the timing line.
    if (!/^\d+$/.test(indexStr)) {
      if (indexStr.includes('-->')) {
        timecodeLine = indexStr
        indexStr = String(srtIndex)
        textStartIdx = 1
      } else {
        continue
      }
    }
    
    if (!timecodeLine || !timecodeLine.includes('-->')) {
      continue
    }
    
    const originalTextRaw = lines.slice(textStartIdx).join('\n')
    const originalText = originalTextRaw.replace(/<font[^>]*>|<\/font>/gi, '').trim()
    if (!originalText) continue
    
    blocks.push({
      id: randomUUID(),
      type: 'paragraph',
      originalText,
      style: {
        fontSize: 12,
        fontWeight: 'normal',
      },
      metadata: {
        chapterHref: 'subtitle_chapter',
        srtIndex: parseInt(indexStr, 10) || srtIndex,
        srtTimecode: timecodeLine
      }
    })
    srtIndex++
  }
  
  const pageCount = Math.ceil(blocks.length / 20) || 1
  
  return { blocks, pageCount }
}
