import { NextRequest } from 'next/server'
import { translateBlocks } from '@/lib/translators'
import { DocumentBlock, TranslationConfig } from '@/lib/types'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { blocks, config }: { blocks: DocumentBlock[]; config: TranslationConfig } =
    await request.json()

  if (!blocks?.length) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'Không có nội dung để dịch' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!config?.apiKey) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'Thiếu API key' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  const send = async (data: object) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      // Client disconnected
    }
  }

  ;(async () => {
    try {
      const translated = await translateBlocks(blocks, config, async (completed, total, newlyTranslated) => {
        await send({ type: 'progress', completed, total, newlyTranslated })
      })
      await send({ type: 'complete', blocks: translated })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi dịch'
      await send({ type: 'error', message })
    } finally {
      try {
        await writer.close()
      } catch {
        // Already closed
      }
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
    },
  })
}
