import { NextRequest, NextResponse } from 'next/server'
import { DocumentBlock, ExportFormat } from '@/lib/types'
import { exportHTML } from '@/lib/exporters/html'
import { exportPDF } from '@/lib/exporters/pdf'
import { exportEPUB } from '@/lib/exporters/epub'
import { exportDOCX } from '@/lib/exporters/docx'

export const maxDuration = 120

const MIME: Record<ExportFormat, string> = {
  html: 'text/html',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function POST(request: NextRequest) {
  try {
    const {
      blocks,
      format,
      title,
      bilingual,
    }: {
      blocks: DocumentBlock[]
      format: ExportFormat
      title: string
      bilingual?: boolean
    } = await request.json()

    if (!blocks?.length) {
      return NextResponse.json({ error: 'Không có nội dung để xuất' }, { status: 400 })
    }

    const safeTitle = title || 'Bản dịch'
    let content: Buffer | string

    switch (format) {
      case 'html':
        content = exportHTML(blocks, safeTitle, bilingual)
        break
      case 'pdf':
        content = await exportPDF(blocks, safeTitle, bilingual)
        break
      case 'epub':
        content = await exportEPUB(blocks, safeTitle, bilingual)
        break
      case 'docx':
        content = await exportDOCX(blocks, safeTitle, bilingual)
        break
      default:
        return NextResponse.json({ error: 'Định dạng không hỗ trợ' }, { status: 400 })
    }

    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
    return new Response(body as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': MIME[format],
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.${format}"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    const message = err instanceof Error ? err.message : 'Lỗi xuất file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
