import { DocumentBlock, TranslationConfig } from '../types'

const CHUNK_SIZE = 12
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1500

type TranslatedItem = {
  id: string
  translatedText: string
  cefrAnnotatedOriginal?: string
  cefrAnnotatedTranslation?: string
}

type ProgressCallback = (
  completed: number,
  total: number,
  newlyTranslated: TranslatedItem[]
) => void

export async function translateBlocks(
  blocks: DocumentBlock[],
  config: TranslationConfig,
  onProgress: ProgressCallback,
  signal?: AbortSignal
): Promise<DocumentBlock[]> {
  // Code blocks are never translated
  const translatableBlocks = blocks.filter(b => b.type !== 'code' && b.type !== 'image')
  const chunkSize = config.provider === 'gemini' ? 120 : CHUNK_SIZE
  const chunks = chunkArray(translatableBlocks, chunkSize)
  const result = [...blocks]
  let completed = 0

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) break

    if (i > 0 && config.provider === 'gemini') {
      await delay(2000)
    }

    const chunk = chunks[i]
    const contextBefore = i > 0 ? chunks[i - 1][chunks[i - 1].length - 1]?.originalText : undefined
    const contextAfter = i < chunks.length - 1 ? chunks[i + 1][0]?.originalText : undefined

    const translated = await translateChunkWithRetry(chunk, contextBefore, contextAfter, config, 0, signal)

    for (const t of translated) {
      const target = result.find(b => b.id === t.id)
      if (target) {
        target.translatedText = t.translatedText
        if (t.cefrAnnotatedOriginal) target.cefrAnnotatedOriginal = t.cefrAnnotatedOriginal
        if (t.cefrAnnotatedTranslation) target.cefrAnnotatedTranslation = t.cefrAnnotatedTranslation
      }
    }

    completed += chunk.length
    onProgress(completed, translatableBlocks.length, translated)
  }

  return result
}

async function translateChunkWithRetry(
  chunk: DocumentBlock[],
  contextBefore: string | undefined,
  contextAfter: string | undefined,
  config: TranslationConfig,
  attempt = 0,
  signal?: AbortSignal
): Promise<TranslatedItem[]> {
  try {
    return await callTranslationAPI(chunk, contextBefore, contextAfter, config, signal)
  } catch (err) {
    // AbortError không retry — trả lỗi lên để dừng vòng lặp
    if (err instanceof Error && err.name === 'AbortError') throw err
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * (attempt + 1))
      return translateChunkWithRetry(chunk, contextBefore, contextAfter, config, attempt + 1, signal)
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
  config: TranslationConfig,
  signal?: AbortSignal
): Promise<TranslatedItem[]> {
  const prompt = buildPrompt(chunk, contextBefore, contextAfter, config.cefrAnnotation)
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

    const res = await client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      },
      { signal }
    )
    rawText = res.choices[0].message.content || '{}'
  } else if (config.provider === 'claude') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: config.apiKey })
    const model = config.model || 'claude-sonnet-4-6'
    const res = await client.messages.create(
      {
        model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt + '\n\nChỉ trả về JSON thuần túy, không có markdown hay giải thích thêm.' }],
      },
      { signal }
    )
    rawText = res.content[0].type === 'text' ? res.content[0].text : '{}'
  } else {
    // Gemini
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: config.apiKey })

    const itemProperties: Record<string, { type: string }> = {
      id: { type: 'STRING' },
      translatedText: { type: 'STRING' },
    }
    const itemRequired = ['id', 'translatedText']

    if (config.cefrAnnotation) {
      itemProperties.cefrAnnotatedOriginal = { type: 'STRING' }
      itemProperties.cefrAnnotatedTranslation = { type: 'STRING' }
      itemRequired.push('cefrAnnotatedOriginal', 'cefrAnnotatedTranslation')
    }

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        translations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: itemProperties,
            required: itemRequired,
          },
        },
      },
      required: ['translations'],
    }

    const targetModel = config.model || 'gemini-2.5-flash'

    const res = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        ...(config.cacheName && {
          cachedContent: config.cacheName
        })
      }
    })
    rawText = res.text || '{}'
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI response is not valid JSON')

  const parsed = JSON.parse(jsonMatch[0]) as { translations?: TranslatedItem[] }
  if (!Array.isArray(parsed.translations)) throw new Error('AI response missing "translations" array')
  return parsed.translations
}

function buildPrompt(
  chunk: DocumentBlock[],
  contextBefore?: string,
  contextAfter?: string,
  cefrAnnotation?: boolean
): string {
  const items = chunk.map(b => ({
    id: b.id,
    type: b.type,
    text: b.originalText,
  }))

  const cefrSection = cefrAnnotation ? `
ĐÁNH DẤU CEFR (bắt buộc khi bật tính năng này):
- Xác định từ/cụm từ tiếng Anh từ B1 trở lên (B1, B2, C1, C2) theo khung CEFR châu Âu
- cefrAnnotatedOriginal: thêm [B1], [B2], [C1] hoặc [C2] ngay SAU từ/cụm từ tiếng Anh đó
- cefrAnnotatedTranslation: thêm CÙNG nhãn ngay SAU từ/cụm từ tiếng Việt tương ứng
- translatedText: bản dịch thuần tiếng Việt, KHÔNG có nhãn CEFR
- Chỉ đánh dấu từ B1 trở lên; từ thông thường A1/A2 KHÔNG đánh dấu
- Ví dụ EN: "The sophisticated [C1] algorithm [B2] efficiently [C1] processes data."
- Ví dụ VI: "Thuật toán [B2] tinh vi [C1] xử lý [C1] dữ liệu một cách hiệu quả."
` : ''

  const responseFormat = cefrAnnotation
    ? `{"translations": [{"id": "...", "translatedText": "...", "cefrAnnotatedOriginal": "...", "cefrAnnotatedTranslation": "..."}, ...]}`
    : `{"translations": [{"id": "...", "translatedText": "..."}, ...]}`

  return `Bạn là chuyên gia dịch thuật hàng đầu với hơn 20 năm kinh nghiệm dịch sách, tài liệu học thuật và văn bản chuyên ngành từ tiếng Anh sang tiếng Việt. Bạn am hiểu sâu sắc cả hai nền văn hóa và ngôn ngữ, có khả năng truyền tải chính xác ý nghĩa, sắc thái, và văn phong của tác giả gốc vào tiếng Việt tự nhiên, trong sáng.

QUY TẮC DỊCH CHUYÊN NGHIỆP:
- Trả về JSON hợp lệ: ${responseFormat}
- Dịch theo ngữ cảnh: hiểu toàn bộ đoạn văn trước khi dịch, không dịch từng từ rời rạc
- Giữ giọng văn và phong cách của tác giả (trang trọng, thân mật, học thuật, kỹ thuật...)
- Dùng từ ngữ tiếng Việt tự nhiên, lưu loát như người bản ngữ viết — tránh lối dịch "Tây hóa"
- Ưu tiên thành ngữ, cách diễn đạt tiếng Việt tương đương thay vì dịch từng chữ
- Giữ nguyên thuật ngữ kỹ thuật chưa có bản dịch chuẩn (API, blockchain, framework, v.v.)
- Giữ nguyên tên riêng: người, địa danh, thương hiệu, tên sản phẩm
- Giữ nguyên số, ký hiệu toán học, đơn vị đo lường, công thức
- type="code": KHÔNG dịch, giữ nguyên 100%
- type="heading": dịch súc tích, rõ ý, đúng văn phong tiêu đề tiếng Việt
- type="list-item": nhất quán cách dùng từ trong toàn bộ danh sách
- Mỗi block phải dịch đầy đủ ngữ nghĩa, không lược bớt hay tóm tắt ý
${cefrSection}
${contextBefore ? `NGỮ CẢNH ĐOẠN TRƯỚC (tham khảo để dịch nhất quán, KHÔNG dịch lại): "${contextBefore.slice(0, 300)}"` : ''}
${contextAfter ? `NGỮ CẢNH ĐOẠN SAU (tham khảo để hiểu mạch văn, KHÔNG dịch): "${contextAfter.slice(0, 300)}"` : ''}

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
