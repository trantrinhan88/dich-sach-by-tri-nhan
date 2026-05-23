import { NextRequest, NextResponse } from 'next/server'
import { DocumentBlock, TranslationConfig } from '@/lib/types'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { blocks, config }: { blocks: DocumentBlock[]; config: TranslationConfig } =
      await request.json()

    if (!blocks?.length) {
      return NextResponse.json({ error: 'Không có nội dung để đưa vào bộ đệm' }, { status: 400 })
    }

    if (!config?.apiKey) {
      return NextResponse.json({ error: 'Thiếu API key của Gemini' }, { status: 400 })
    }

    // Gộp toàn bộ văn bản gốc của cuốn sách (không dịch mã nguồn và ảnh)
    const bookRawText = blocks
      .filter(b => b.type !== 'code' && b.type !== 'image')
      .map(b => b.originalText)
      .join('\n\n')

    if (!bookRawText.trim()) {
      return NextResponse.json({ error: 'Nội dung sách trống' }, { status: 400 })
    }

    // Tích hợp SDK @google/genai chính thức
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: config.apiKey })

    const targetModel = config.model || 'gemini-2.5-flash'

    console.log(`[Cache API] Đang tạo Context Cache cho model: ${targetModel}. Kích thước: ${bookRawText.length} ký tự.`)

    // Khởi tạo vùng đệm (Context Cache)
    const cache = await ai.caches.create({
      model: targetModel,
      config: {
        displayName: `epub_translation_${Date.now()}`,
        ttl: '3600s', // Sống trong 1 tiếng để người dùng dịch xong cuốn sách
        contents: [
          {
            role: 'user',
            parts: [{ text: bookRawText }],
          },
        ],
      },
    })

    console.log(`[Cache API] Đã tạo thành công cacheName: ${cache.name}`)

    return NextResponse.json({ cacheName: cache.name })
  } catch (err) {
    console.error('[Cache API Error]:', err)
    const errString = typeof err === 'object' ? JSON.stringify(err) : String(err)
    
    // Tự động phát hiện lỗi giới hạn Free Tier để hạ cấp mượt mà (Graceful Degradation)
    if (
      errString.includes('FreeTier') || 
      errString.includes('limit exceeded') || 
      errString.includes('RESOURCE_EXHAUSTED') ||
      errString.includes('limit=0')
    ) {
      console.log('[Cache API] Caching is not supported on this API key (Free Tier limit=0). Falling back to standard translation.')
      return NextResponse.json({
        cacheNotSupported: true,
        warning: 'Tài khoản miễn phí (Free Tier) không hỗ trợ bộ nhớ đệm Context Caching. Hệ thống tự động dịch trực tiếp không dùng cache.'
      })
    }

    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi tạo cache'
    return NextResponse.json({ error: `Lỗi tạo bộ đệm: ${message}` }, { status: 500 })
  }
}
