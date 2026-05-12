import { DocumentBlock, TranslationConfig } from '../types'

const CHUNK_SIZE = 12
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1500

type ProgressCallback = (completed: number, total: number) => void

export async function translateBlocks(
  blocks: DocumentBlock[],
  config: TranslationConfig,
  onProgress: ProgressCallback
): Promise<DocumentBlock[]> {
  // Code blocks are never translated
  const translatableBlocks = blocks.filter(b => b.type !== 'code' && b.type !== 'image')
  const chunks = chunkArray(translatableBlocks, CHUNK_SIZE)
  const result = [...blocks]
  let completed = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const contextBefore = i > 0 ? chunks[i - 1][chunks[i - 1].length - 1]?.originalText : undefined
    const contextAfter = i < chunks.length - 1 ? chunks[i + 1][0]?.originalText : undefined

    const translated = await translateChunkWithRetry(chunk, contextBefore, contextAfter, config)

    for (const t of translated) {
      const target = result.find(b => b.id === t.id)
      if (target) target.translatedText = t.translatedText
    }

    completed += chunk.length
    onProgress(completed, translatableBlocks.length)
  }

  return result
}

async function translateChunkWithRetry(
  chunk: DocumentBlock[],
  contextBefore: string | undefined,
  contextAfter: string | undefined,
  config: TranslationConfig,
  attempt = 0
): Promise<{ id: string; translatedText: string }[]> {
  try {
    return await callTranslationAPI(chunk, contextBefore, contextAfter, config)
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * (attempt + 1))
      return translateChunkWithRetry(chunk, contextBefore, contextAfter, config, attempt + 1)
    }
    // Fallback: mark as untranslated rather than crash the whole document
    console.error('Translation chunk failed after retries:', err)
    return chunk.map(b => ({ id: b.id, translatedText: `[CHƯA DỊCH] ${b.originalText}` }))
  }
}

async function callTranslationAPI(
  chunk: DocumentBlock[],
  contextBefore: string | undefined,
  contextAfter: string | undefined,
  config: TranslationConfig
): Promise<{ id: string; translatedText: string }[]> {
  const prompt = buildPrompt(chunk, contextBefore, contextAfter)
  let rawText: string

  if (config.provider === 'deepseek' || config.provider === 'openai') {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.provider === 'deepseek' ? 'https://api.deepseek.com' : undefined,
    })
    const model =
      config.model ||
      (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')

    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })
    rawText = res.choices[0].message.content || '{}'
  } else {
    // Gemini
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({
      model: config.model || 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })
    const res = await model.generateContent(prompt)
    rawText = res.response.text()
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI response is not valid JSON')

  const parsed = JSON.parse(jsonMatch[0]) as { translations?: { id: string; translatedText: string }[] }
  if (!Array.isArray(parsed.translations)) throw new Error('AI response missing "translations" array')
  return parsed.translations
}

function buildPrompt(
  chunk: DocumentBlock[],
  contextBefore?: string,
  contextAfter?: string
): string {
  const items = chunk.map(b => ({
    id: b.id,
    type: b.type,
    text: b.originalText,
  }))

  return `Bạn là dịch giả chuyên nghiệp, thành thạo dịch mọi ngôn ngữ sang tiếng Việt tự nhiên, chuẩn văn phong.

QUY TẮC DỊCH:
- Trả về JSON hợp lệ: {"translations": [{"id": "...", "translatedText": "..."}, ...]}
- Dịch tự nhiên, lưu loát như người Việt viết, không dịch máy
- Giữ nguyên thuật ngữ kỹ thuật nếu chưa có bản dịch chuẩn (ví dụ: API, blockchain, framework)
- Giữ nguyên tên riêng: người, địa danh, thương hiệu, tên sản phẩm
- Giữ nguyên số, ký hiệu toán học, đơn vị đo lường
- Với type="code": KHÔNG dịch, giữ nguyên 100%
- Với type="heading": dịch ngắn gọn, súc tích, đúng văn phong tiêu đề
- Với type="list-item": dịch nhất quán về cách dùng từ với các mục khác trong danh sách
- Mỗi block dịch đủ ngữ nghĩa, không tóm tắt hay bỏ bớt ý

${contextBefore ? `NGỮ CẢNH PHÍA TRƯỚC (chỉ để tham khảo, KHÔNG dịch): "${contextBefore.slice(0, 300)}"` : ''}
${contextAfter ? `NGỮ CẢNH PHÍA SAU (chỉ để tham khảo, KHÔNG dịch): "${contextAfter.slice(0, 300)}"` : ''}

BLOCKS CẦN DỊCH:
${JSON.stringify(items, null, 2)}`
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
