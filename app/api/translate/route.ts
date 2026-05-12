import { NextRequest } from 'next/server'
import { translateBlocks } from '@/lib/translators'
import { DocumentBlock, TranslationConfig } from '@/lib/types'

export const maxDuration = 600

function splitEnglishSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map(s => s.trim())
    .filter(Boolean)
}

function expandForBilingual(blocks: DocumentBlock[]): DocumentBlock[] {
  const result: DocumentBlock[] = []
  let seq = 0
  for (const block of blocks) {
    if (block.type !== 'paragraph') { result.push(block); continue }
    const sentences = splitEnglishSentences(block.originalText)
    if (sentences.length <= 3) { result.push(block); continue }
    for (let i = 0; i < sentences.length; i += 3) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { translatedText: _t, ...rest } = block
      result.push({ ...rest, id: `${block.id}-${seq++}`, originalText: sentences.slice(i, i + 3).join(' ') })
    }
  }
  return result
}

export async function POST(request: NextRequest) {
  const { blocks, config, bilingual }: { blocks: DocumentBlock[]; config: TranslationConfig; bilingual?: boolean } =
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

  const workingBlocks = bilingual ? expandForBilingual(blocks) : blocks

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
      const translated = await translateBlocks(workingBlocks, config, async (completed, total) => {
        await send({ type: 'progress', completed, total })
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
