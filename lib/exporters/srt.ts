import { DocumentBlock } from '../types'

export function exportSRT(blocks: DocumentBlock[], bilingual?: boolean): string {
  let srtContent = ''
  let count = 1
  
  for (const block of blocks) {
    const timecode = (block.metadata?.srtTimecode as string) || '00:00:00,000 --> 00:00:00,000'
    const index = count
    
    const original = block.originalText || ''
    let translated = block.translatedText || ''
    if (translated.startsWith('[CHƯA DỊCH]')) {
      translated = original
    }
    
    let text = ''
    if (bilingual) {
      if (translated && translated !== original) {
        text = `${translated}\n${original}`
      } else {
        text = original
      }
    } else {
      text = translated || original
    }
    
    srtContent += `${index}\n${timecode}\n${text}\n\n`
    count++
  }
  
  return srtContent.trim() + '\n'
}
