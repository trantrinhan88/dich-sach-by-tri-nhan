import fs from 'fs/promises'
import path from 'path'

const FONT_DIR = path.join(process.cwd(), '.fonts')
const FONT_PATH = path.join(FONT_DIR, 'NotoSans-Regular.ttf')
const FONT_BOLD_PATH = path.join(FONT_DIR, 'NotoSans-Bold.ttf')

// Reliable GitHub raw URLs for Noto Sans (supports Vietnamese)
const FONT_URL = 'https://github.com/notofonts/latin-greek-cyrillic/raw/main/fonts/NotoSans/unhinted/ttf/NotoSans-Regular.ttf'
const FONT_BOLD_URL = 'https://github.com/notofonts/latin-greek-cyrillic/raw/main/fonts/NotoSans/unhinted/ttf/NotoSans-Bold.ttf'

async function downloadFont(url: string, dest: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Font download failed: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(dest, buffer)
  return buffer
}

export async function getFont(bold = false): Promise<Buffer> {
  const fontPath = bold ? FONT_BOLD_PATH : FONT_PATH
  const fontUrl = bold ? FONT_BOLD_URL : FONT_URL

  try {
    return await fs.readFile(fontPath)
  } catch {
    // Download and cache
    try {
      await fs.mkdir(FONT_DIR, { recursive: true })
      console.log(`Downloading Vietnamese font from ${fontUrl}...`)
      return await downloadFont(fontUrl, fontPath)
    } catch (err) {
      throw new Error(`Cannot load Vietnamese font. Please check internet connection. Error: ${err}`)
    }
  }
}
