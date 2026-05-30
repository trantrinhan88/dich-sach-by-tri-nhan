import { NextRequest, NextResponse } from 'next/server'
import { parsePDF } from '@/lib/parsers/pdf'
import { parseEPUB } from '@/lib/parsers/epub'
import { parseSRT } from '@/lib/parsers/srt'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const buffer = await file.arrayBuffer()

    if (fileName.endsWith('.pdf')) {
      const { blocks, pageCount } = await parsePDF(buffer)
      return NextResponse.json({ blocks, pageCount, fileType: 'pdf', fileName: file.name })
    }

    if (fileName.endsWith('.epub')) {
      const { blocks, pageCount } = await parseEPUB(buffer)
      return NextResponse.json({ blocks, pageCount, fileType: 'epub', fileName: file.name })
    }

    if (fileName.endsWith('.srt')) {
      const { blocks, pageCount } = await parseSRT(buffer)
      return NextResponse.json({ blocks, pageCount, fileType: 'srt', fileName: file.name })
    }

    return NextResponse.json(
      { error: 'Định dạng không hỗ trợ. Chỉ hỗ trợ .pdf, .epub và .srt' },
      { status: 400 }
    )
  } catch (err) {
    console.error('Parse error:', err)
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ error: `Không thể đọc file: ${message}` }, { status: 500 })
  }
}
