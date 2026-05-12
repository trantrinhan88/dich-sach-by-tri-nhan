'use client'

import { useState } from 'react'
import { DocumentBlock } from '@/lib/types'

interface Props {
  blocks: DocumentBlock[]
  bilingual?: boolean
}

const TYPE_BADGE: Record<string, string> = {
  heading: 'H',
  paragraph: 'P',
  'list-item': 'Li',
  'table-cell': 'Td',
  caption: 'Fig',
  code: 'Code',
  image: 'Img',
}

function BlockRow({ block, bilingual }: { block: DocumentBlock; bilingual: boolean }) {
  const isCode = block.type === 'code'
  const isUntranslated = !block.translatedText && !isCode

  // Bilingual paragraph: stacked EN (gray) → VI
  if (bilingual && block.translatedText && block.type === 'paragraph') {
    return (
      <div className="rounded-lg overflow-hidden text-sm border border-gray-700">
        <div className="bg-gray-900 px-3 py-2 border-b border-gray-700/50">
          <p className="text-gray-500 italic text-xs leading-relaxed whitespace-pre-wrap">{block.originalText}</p>
        </div>
        <div className="bg-gray-950 px-3 py-2.5">
          <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">{block.translatedText}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-2 gap-px bg-gray-700 rounded-lg overflow-hidden text-sm ${
        isUntranslated ? 'ring-1 ring-yellow-500/50' : ''
      }`}
    >
      {/* Original */}
      <div className="bg-gray-900 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-mono bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
            {TYPE_BADGE[block.type] || 'P'}
            {block.style.level ? block.style.level : ''}
          </span>
          <span className="text-xs text-gray-500">Gốc</span>
        </div>
        <p
          className={`text-gray-200 leading-relaxed whitespace-pre-wrap ${
            block.type === 'heading' ? 'font-bold' : ''
          } ${isCode ? 'font-mono text-xs text-green-300' : ''}`}
        >
          {block.originalText}
        </p>
      </div>

      {/* Translated */}
      <div className="p-3" style={{ backgroundColor: '#111827' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-gray-500">Tiếng Việt</span>
          {isUntranslated && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
              chưa dịch
            </span>
          )}
          {isCode && (
            <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
              giữ nguyên
            </span>
          )}
        </div>
        <p
          className={`leading-relaxed whitespace-pre-wrap ${
            isUntranslated ? 'text-yellow-300/70' : 'text-gray-100'
          } ${block.type === 'heading' ? 'font-bold' : ''} ${
            isCode ? 'font-mono text-xs text-green-300' : ''
          }`}
        >
          {isCode ? block.originalText : block.translatedText || block.originalText}
        </p>
      </div>
    </div>
  )
}

export default function DocumentPreview({ blocks, bilingual = false }: Props) {
  const [filter, setFilter] = useState<'all' | 'translated' | 'untranslated'>('all')
  const [page, setPage] = useState(1)
  const PER_PAGE = 30

  const filtered = blocks.filter(b => {
    if (filter === 'translated') return !!b.translatedText || b.type === 'code'
    if (filter === 'untranslated') return !b.translatedText && b.type !== 'code'
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const untranslatedCount = blocks.filter(b => !b.translatedText && b.type !== 'code').length

  return (
    <div className="space-y-4">
      {/* Stats + filter */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 border border-gray-700">
        <span className="text-gray-400 text-sm">
          <span className="text-white font-medium">{blocks.length}</span> đoạn
        </span>
        {untranslatedCount > 0 && (
          <span className="text-yellow-400 text-sm">
            · <span className="font-medium">{untranslatedCount}</span> chưa dịch
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {(['all', 'translated', 'untranslated'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? 'Tất cả' : f === 'translated' ? 'Đã dịch' : 'Chưa dịch'}
            </button>
          ))}
        </div>
      </div>

      {!bilingual && (
        <div className="grid grid-cols-2 gap-px px-1">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bản gốc</span>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bản dịch tiếng Việt</span>
        </div>
      )}

      {/* Block list */}
      <div className="space-y-2">
        {visible.map(block => (
          <BlockRow key={block.id} block={block} bilingual={bilingual} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40 text-sm"
          >
            ← Trước
          </button>
          <span className="text-gray-400 text-sm">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-40 text-sm"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  )
}
