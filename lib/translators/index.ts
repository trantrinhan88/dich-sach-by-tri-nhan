import { DocumentBlock, TranslationConfig } from '../types'

const CHUNK_SIZE = 40
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1500

// System prompt dịch giả văn học — chỉ dùng cho DeepSeek (hỗ trợ system role)
const LITERARY_SYSTEM_PROMPT = `Bạn là một dịch giả văn học đại tài, có sự am hiểu sâu sắc về văn học cổ điển lẫn hiện đại, sở hữu vốn từ vựng tiếng Việt phong phú, tự nhiên, truyền cảm và giàu nhạc điệu.

NHIỆM VỤ QUAN TRỌNG NHẤT:
- Dịch toàn bộ nội dung được cung cấp từ tiếng Anh sang tiếng Việt.
- BẢN DỊCH BẮT BUỘC PHẢI DÙNG CHỮ QUỐC NGỮ TIẾNG VIỆT HIỆN ĐẠI.
- TUYỆT ĐỐI KHÔNG ĐƯỢC dịch sang tiếng Trung (chữ Hán/giản thể/phồn thể), chữ Nôm hay bất kỳ ngôn ngữ nào khác ngoài tiếng Việt. Không được phép chứa bất kỳ ký tự chữ Hán (chữ Trung Quốc) nào trong kết quả dịch.

QUY TẮC NHÂN XƯNG (cốt lõi):
- TUYỆT ĐỐI KHÔNG sử dụng các từ mang tính chất cổ trang/kiếm hiệp phương Đông hoặc không phù hợp với văn học phương Tây như: "chàng", "nàng" ("chàng - nàng", "thiếp - chàng"), "huynh - muội", "tỷ - muội", "lão - gã", "kẻ hoang đàng - người khuê các", "kẻ này - người kia", "ngươi - ta".
- TUYỆT ĐỐI KHÔNG sử dụng cặp "tôi - bạn" một cách máy móc trong các tác phẩm văn học nghệ thuật.
- TUYỆT ĐỐI KHÔNG sử dụng từ "đàn bà" (khi ám chỉ phụ nữ nói chung); hãy luôn sử dụng từ "phụ nữ" để thay thế nhằm đảm bảo sắc thái lịch sự, trang trọng và văn minh.
- Vì đây là tác phẩm văn học phương Tây, hãy sử dụng các cặp nhân xưng văn minh, tự nhiên, đúng văn phong phương Tây như:
  + Cặp đôi yêu nhau hoặc vợ chồng: anh - em, ông - bà (nếu là vợ chồng già).
  + Quan hệ xã giao, lịch thiệp, trang trọng: tôi - anh, tôi - cô, tôi - ông, tôi - bà.
  + Quan hệ gia đình: cha - con, mẹ - con, chú - cháu, anh - em...
  + Ngôi thứ ba khi mô tả/narrate: Ưu tiên hàng đầu dùng "anh ấy" (cho nam giới) và "cô ấy" (cho nữ giới) trước hết; hạn chế dùng "gã", "hắn", "y", "ông ấy", "bà ấy" trừ khi ngữ cảnh đặc thù yêu cầu.
- Đại từ nhân xưng phải thay đổi linh hoạt theo ngữ cảnh, độ tuổi, địa vị, mối quan hệ và dòng cảm xúc của nhân vật: khi yêu thương thì tha thiết, khi phẫn nộ thì lạnh lùng, khi độc thoại nội tâm thì tự nhiên và sâu sắc.

QUY TẮC NHỊP ĐIỆU CÂU VĂN:
- Câu văn cần có nhịp điệu, có sự trầm bổng, trôi chảy, tránh lối viết cụt ngủn hay diễn đạt theo kiểu ngôn ngữ nói hiện đại.

QUY TẮC NGỮ CẢNH & DỊCH THOÁT Ý:
- Luôn ghi nhớ dòng thời gian, không gian và tâm trạng xuyên suốt để không làm đứt gãy mạch cảm xúc.
- Dịch thoát ý đắt giá và tinh tế thay vì dịch thô kệch từng chữ (word-by-word). 
  + Ví dụ: các khái niệm mang tính ước lệ cao như "the woman" nên dịch thoát thành "người phụ nữ duy nhất" để lột tả vị trí độc tôn trong tâm trí nhân vật, hay "whole of her sex" dịch mượt mà là "tất cả những người phụ nữ khác" để phù hợp với văn phong tiếng Việt tự nhiên.
  + Đối với câu phức dài tiếng Anh, hãy ngắt nghỉ hợp lý và kết hợp liên từ trôi chảy ("bị cuốn hút bởi... và dùng... để truy tìm... và làm sáng tỏ...") tạo cảm giác mạch lạc, cuốn hút như truyện trinh thám/văn học cổ điển thực thụ.

VÍ DỤ VĂN BẢN VÀ BẢN DỊCH TIÊU CHUẨN (HỌC TẬP PHONG CÁCH):
- EN: "To Sherlock Holmes she is always the woman."
  -> VI: "Đối với Sherlock Holmes, cô ấy mãi mãi là người phụ nữ duy nhất."
- EN: "I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex."
  -> VI: "Tôi hiếm khi nghe anh ấy nhắc đến cô ấy bằng một cái tên nào khác. Trong mắt anh ấy, cô ấy làm lu mờ và nổi bật hơn tất cả những người phụ nữ khác."
- EN: "He was still, as ever, deeply attracted by the study of crime, and occupied his immense faculties and extraordinary powers of observation in following out those clues, and clearing up those mysteries which had been abandoned as hopeless by the official police."
  -> VI: "Anh ấy vẫn như mọi khi, bị cuốn hút sâu sắc bởi việc nghiên cứu tội phạm, và dùng năng lực to lớn cùng khả năng quan sát phi thường của mình để truy tìm những manh mối, và làm sáng tỏ những bí ẩn mà cảnh sát chính thức đã bỏ cuộc vì vô vọng."

QUY TẮC ĐẦU RA:
- Chỉ trả về JSON hợp lệ theo đúng format được yêu cầu trong user message.
- Không giải thích, không thêm bớt ghi chú cá nhân.`


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
  const chunkSize = config.provider === 'gemini' ? 120 : config.provider === 'deepseek' ? 40 : CHUNK_SIZE
  const chunks = chunkArray(translatableBlocks, chunkSize)
  const result = [...blocks]
  let completed = 0
  let fatalError: Error | null = null

  // Xác định mức độ chạy song song (concurrency)
  let concurrency = 1
  if (config.provider === 'deepseek') {
    concurrency = 3 // Giảm xuống 3 để tránh quá tải DeepSeek API
  } else if (config.provider === 'openai') {
    concurrency = 5
  } else if (config.provider === 'claude') {
    concurrency = 3
  } else if (config.provider === 'gemini') {
    const isGeminiFree = !config.geminiPaidApiKey
    concurrency = isGeminiFree ? 1 : 5
  }

  let index = 0
  const workers: Promise<void>[] = []

  async function worker() {
    while (index < chunks.length) {
      if (signal?.aborted || fatalError) break

      const currentIdx = index++
      const chunk = chunks[currentIdx]

      // Gemini rate limit delay (chỉ áp dụng khi chạy tuần tự)
      if (config.provider === 'gemini' && currentIdx > 0) {
        const isGeminiFree = !config.geminiPaidApiKey
        if (isGeminiFree) {
          // Gemini Free: chờ 4.5 giây giữa các chunk để tránh chạm ngưỡng 15 RPM
          await delay(4500)
        } else if (concurrency === 1) {
          await delay(1000)
        }
      }

      const contextBefore = currentIdx > 0 ? chunks[currentIdx - 1][chunks[currentIdx - 1].length - 1]?.originalText : undefined
      const contextAfter = currentIdx < chunks.length - 1 ? chunks[currentIdx + 1][0]?.originalText : undefined

      try {
        const translated = await translateChunkWithRetry(chunk, contextBefore, contextAfter, config, 0, signal)
        
        if (signal?.aborted || fatalError) break

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
      } catch (err) {
        console.error(`Lỗi khi dịch chunk ${currentIdx}:`, err)
        if (err instanceof Error && err.name === 'AbortError') {
          break
        }
        // Nếu gặp lỗi nghiêm trọng (Fatal), gán vào biến chia sẻ để dừng các worker khác
        if (err instanceof Error && (err as any).isFatal) {
          fatalError = err
          break
        }
      }
    }
  }

  // Khởi động các worker song song
  const numWorkers = Math.min(concurrency, chunks.length)
  for (let w = 0; w < numWorkers; w++) {
    workers.push(worker())
  }

  await Promise.all(workers)

  // Nếu có lỗi nghiêm trọng xảy ra trong quá trình chạy worker, ném ra ngoài để dừng tiến trình API Route
  if (fatalError) {
    throw fatalError
  }

  return result
}

function isFatalError(e: any): boolean {
  const status = e?.status
  const msg = String(e?.message || e || '').toLowerCase()

  // 401: Unauthorized (key sai), 402: Payment Required (hết tiền), 403: Forbidden, 404: Not Found
  if (status === 401 || status === 402 || status === 403 || status === 404) {
    return true
  }

  // Các thông điệp lỗi phổ biến từ DeepSeek hoặc OpenAI liên quan đến khóa API hoặc số dư tài khoản
  if (
    msg.includes('api key') ||
    msg.includes('unauthorized') ||
    msg.includes('insufficient_balance') ||
    msg.includes('insufficient balance') ||
    msg.includes('balance') ||
    msg.includes('credit') ||
    msg.includes('billing') ||
    msg.includes('invalid_api_key') ||
    msg.includes('payment')
  ) {
    return true
  }

  return false
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
  } catch (err: any) {
    // AbortError không retry — trả lỗi lên để dừng vòng lặp
    if (err instanceof Error && err.name === 'AbortError') throw err

    // Kiểm tra và xử lý lỗi nghiêm trọng ngay lập tức
    if (isFatalError(err)) {
      console.error('[Translation Fatal Error] Gặp lỗi nghiêm trọng, dừng dịch ngay lập tức:', err)
      const fatalErr = err instanceof Error ? err : new Error(String(err))
      ;(fatalErr as any).isFatal = true
      throw fatalErr
    }

    const isRateLimit = (e: any) => {
      const msg = String(e?.message || e || '').toLowerCase()
      return (
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('quota') ||
        e?.status === 429
      )
    }

    if (isRateLimit(err)) {
      const rateLimitRetries = 5
      if (attempt < rateLimitRetries) {
        const backoff = 20000 * (attempt + 1)
        console.warn(
          `[Gemini Rate Limit] Gặp lỗi giới hạn tần suất (429/Quota). Chờ ${backoff / 1000} giây trước khi thử lại (lần thử ${attempt + 1}/${rateLimitRetries})...`
        )
        await delay(backoff)
        return translateChunkWithRetry(chunk, contextBefore, contextAfter, config, attempt + 1, signal)
      }
    } else {
      if (attempt < MAX_RETRIES) {
        // Đợi lâu hơn một chút đối với lỗi kết nối/server/timeout (5s, 10s, 15s) để API có thời gian phục hồi
        const backoff = 5000 * (attempt + 1)
        console.warn(
          `[Translation API Error] Gặp lỗi kết nối/server (${err.message || err}). Đang thử lại sau ${backoff / 1000} giây (lần thử ${attempt + 1}/${MAX_RETRIES})...`
        )
        await delay(backoff)
        return translateChunkWithRetry(chunk, contextBefore, contextAfter, config, attempt + 1, signal)
      }
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
  const prompt = buildPrompt(chunk, contextBefore, contextAfter, config.cefrAnnotation, config.provider)
  let rawText: string

  if (config.provider === 'deepseek' || config.provider === 'openai') {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.provider === 'deepseek' ? 'https://api.deepseek.com' : undefined,
      timeout: 60000, // Cài đặt 60 giây timeout cho OpenAI client
    })

    // Map friendly model names → actual DeepSeek API model names
    let resolvedModel = config.model || (config.provider === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4o-mini')
    if (config.provider === 'deepseek') {
      if (resolvedModel === 'deepseek-v4-flash') resolvedModel = 'deepseek-chat'
      else if (resolvedModel === 'deepseek-v4-pro') resolvedModel = 'deepseek-reasoner'
    }

    // deepseek-reasoner không hỗ trợ response_format: json_object
    const isReasoner = resolvedModel === 'deepseek-reasoner'
    const isDeepSeek = config.provider === 'deepseek'

    // DeepSeek: tách system prompt (vai trò dịch giả văn học) + user message (quy tắc JSON + blocks)
    const messages: { role: 'system' | 'user'; content: string }[] = isDeepSeek
      ? [
          { role: 'system', content: LITERARY_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ]
      : [{ role: 'user', content: prompt }]

    const createParams: Parameters<typeof client.chat.completions.create>[0] = {
      model: resolvedModel,
      messages,
      temperature: isReasoner ? undefined : 0.2,
      ...(isReasoner ? {} : { response_format: { type: 'json_object' as const } }),
    }

    // Gửi yêu cầu với timeout 60 giây ở cấp độ request
    const res = (await client.chat.completions.create(createParams, { signal, timeout: 60000 })) as any
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
  cefrAnnotation?: boolean,
  provider?: string
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

  // Với DeepSeek: system prompt đã mang vai trò dịch giả văn học → user message chỉ cần rules JSON + blocks
  // Với các provider khác: giữ nguyên prompt đầy đủ như cũ
  const preamble = provider === 'deepseek'
    ? `Hãy dịch các blocks sau từ tiếng Anh sang tiếng Việt (BẮT BUỘC dùng chữ Quốc ngữ tiếng Việt hiện đại, TUYỆT ĐỐI KHÔNG dịch sang chữ Hán/tiếng Trung) theo đúng phong cách văn học đại tài đã được định sẵn trong vai trò của bạn.`
    : `Bạn là chuyên gia dịch thuật hàng đầu với hơn 20 năm kinh nghiệm dịch sách, tài liệu học thuật và văn bản chuyên ngành từ tiếng Anh sang tiếng Việt. Bạn am hiểu sâu sắc cả hai nền văn hóa và ngôn ngữ, có khả năng truyền tải chính xác ý nghĩa, sắc thái, và văn phong của tác giả gốc vào tiếng Việt tự nhiên, trong sáng.`

  return `${preamble}

QUY TẮC DỊCH:
- Trả về JSON hợp lệ: ${responseFormat}
- BẢN DỊCH PHẢI LÀ TIẾNG VIỆT 100% (chữ Quốc ngữ), TUYỆT ĐỐI KHÔNG dịch sang tiếng Trung (chữ Hán), chữ Nôm.
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
