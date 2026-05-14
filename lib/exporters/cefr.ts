// CEFR colors: B1=blue, B2=green, C1=amber, C2=red
export const CEFR_COLORS: Record<string, string> = {
  B1: '#3b82f6',
  B2: '#10b981',
  C1: '#f59e0b',
  C2: '#ef4444',
}

// Without '#' prefix for DOCX (which uses hex strings)
export const CEFR_COLORS_HEX: Record<string, string> = {
  B1: '3b82f6',
  B2: '10b981',
  C1: 'f59e0b',
  C2: 'ef4444',
}

export const CEFR_CSS = `
.cefr-b1 { color: #3b82f6; font-size: 0.65em; font-weight: 700; vertical-align: super; }
.cefr-b2 { color: #10b981; font-size: 0.65em; font-weight: 700; vertical-align: super; }
.cefr-c1 { color: #f59e0b; font-size: 0.65em; font-weight: 700; vertical-align: super; }
.cefr-c2 { color: #ef4444; font-size: 0.65em; font-weight: 700; vertical-align: super; }
`

// Wrap [B1]/[B2]/[C1]/[C2] markers in colored spans for HTML/EPUB
export function renderCefrHTML(text: string): string {
  return text.replace(/\[(B1|B2|C1|C2)\]/g, (_, level: string) =>
    `<span class="cefr-${level.toLowerCase()}">[${level}]</span>`
  )
}

export type TextSegment = { text: string; cefrLevel?: string }

// Split text into plain segments and CEFR marker segments
export function splitByCefr(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /\[(B1|B2|C1|C2)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) })
    }
    segments.push({ text: match[0], cefrLevel: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text }]
}

// Strip all CEFR markers from text
export function stripCefr(text: string): string {
  return text.replace(/\s*\[(B1|B2|C1|C2)\]/g, '')
}
