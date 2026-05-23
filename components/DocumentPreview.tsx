'use client'

import { useState, useEffect, useRef } from 'react'
import { DocumentBlock } from '@/lib/types'
import { addVocabItem } from '@/lib/vocab'

interface Props {
  blocks: DocumentBlock[]
  bilingual?: boolean
  bookId?: string
  initialPage?: number
  onPageChange?: (page: number) => void
  onBackToLibrary?: () => void
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

interface SelectionInfo {
  text: string
  x: number
  y: number
  context: string
  translation: string
}

// Sub-component for individual blocks (Bilingual / Standard)
function BlockRow({
  block,
  bilingual,
  readerMode,
  onTextSelect,
}: {
  block: DocumentBlock
  bilingual: boolean
  readerMode: boolean
  onTextSelect: (block: DocumentBlock) => void
}) {
  const isCode = block.type === 'code'
  const isUntranslated = !block.translatedText && !isCode
  const [revealed, setRevealed] = useState(false)

  // Toggle reveal on click
  const handleToggleReveal = () => {
    if (bilingual && block.translatedText) {
      setRevealed(!revealed)
    }
  }

  // Handle bilingual rendering
  if (bilingual && block.translatedText) {
    const isHeading = block.type === 'heading'
    const lvl = block.style.level || 1

    if (readerMode) {
      // Reader Mode Layout: Serif font, indented paragraphs, clean spacing
      return (
        <div 
          className="py-4 border-b border-white/5 group select-text"
          onMouseUp={() => onTextSelect(block)}
        >
          {isHeading ? (
            <h3 
              onClick={handleToggleReveal}
              className={`font-serif font-bold text-white tracking-tight cursor-pointer hover:text-blue-400 transition-colors leading-tight ${
                lvl === 1 ? 'text-2xl mt-6 mb-2' : lvl === 2 ? 'text-xl mt-4 mb-2' : 'text-lg mt-3 mb-1'
              }`}
            >
              {block.translatedText}
            </h3>
          ) : (
            <div className="space-y-2">
              <p 
                onClick={handleToggleReveal}
                className="font-serif text-[17px] leading-relaxed text-gray-300 cursor-pointer hover:text-blue-300 transition-colors"
              >
                {block.originalText}
              </p>
              <p 
                onClick={handleToggleReveal}
                className={`font-serif text-[15px] leading-relaxed text-indigo-300/90 whitespace-pre-wrap transition-all duration-300 origin-top transform ${
                  revealed 
                    ? 'opacity-100 scale-100 max-h-[1000px] blur-0' 
                    : 'opacity-10 scale-[0.99] max-h-[30px] blur-[3px] select-none'
                }`}
              >
                {block.translatedText}
              </p>
            </div>
          )}
        </div>
      )
    }

    // Block Mode Layout (Bilingual)
    return (
      <div 
        className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-md space-y-2 select-text hover:border-white/15 transition-all"
        onMouseUp={() => onTextSelect(block)}
      >
        <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-white/5 pb-1">
          <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">
            {TYPE_BADGE[block.type] || 'P'}{lvl ? lvl : ''}
          </span>
          <span className="italic">💡 Click vào câu để xem bản dịch</span>
        </div>
        <div className="space-y-1.5 cursor-pointer" onClick={handleToggleReveal}>
          <p className="text-sm text-gray-400 font-light leading-relaxed whitespace-pre-wrap">
            {block.originalText}
          </p>
          <p 
            className={`text-sm text-indigo-300 font-medium leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
              revealed 
                ? 'opacity-100 blur-0' 
                : 'opacity-[0.08] blur-[4px] select-none'
            }`}
          >
            {block.translatedText}
          </p>
        </div>
      </div>
    )
  }

  // Fallback / Standard View (Not Bilingual or Not Translated)
  if (readerMode) {
    if (isCode) {
      return (
        <pre className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-green-300 my-4 overflow-x-auto">
          <code>{block.originalText}</code>
        </pre>
      )
    }
    const lvl = block.style.level || 1
    return (
      <div className="py-3 font-serif">
        {block.type === 'heading' ? (
          <h3 className={`font-bold text-white ${lvl === 1 ? 'text-2xl mt-6' : lvl === 2 ? 'text-xl mt-4' : 'text-lg mt-3'}`}>
            {block.translatedText || block.originalText}
          </h3>
        ) : (
          <p className="text-[17px] leading-relaxed text-gray-300">
            {block.translatedText || block.originalText}
          </p>
        )}
      </div>
    )
  }

  // Standard Block Grid Mode
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg ${
        isUntranslated ? 'ring-1 ring-yellow-500/30 border-yellow-500/20' : ''
      }`}
    >
      {/* Original */}
      <div className="bg-gray-950/40 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
            {TYPE_BADGE[block.type] || 'P'}
            {block.style.level ? block.style.level : ''}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Gốc</span>
        </div>
        <p
          className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap ${
            block.type === 'heading' ? 'font-bold text-white' : ''
          } ${isCode ? 'font-mono text-xs text-green-300 bg-black/20 p-2 rounded border border-white/5' : ''}`}
        >
          {block.originalText}
        </p>
      </div>

      {/* Translated */}
      <div className="bg-gray-900/30 p-4 border-t md:border-t-0 md:border-l border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tiếng Việt</span>
          {isUntranslated && (
            <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full font-medium">
              chưa dịch
            </span>
          )}
          {isCode && (
            <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full font-medium">
              giữ nguyên
            </span>
          )}
        </div>
        <p
          className={`text-sm leading-relaxed whitespace-pre-wrap ${
            isUntranslated ? 'text-yellow-300/70 italic' : 'text-white'
          } ${block.type === 'heading' ? 'font-bold' : ''} ${
            isCode ? 'font-mono text-xs text-green-300 bg-black/20 p-2 rounded border border-white/5' : ''
          }`}
        >
          {isCode ? block.originalText : block.translatedText || block.originalText}
        </p>
      </div>
    </div>
  )
}

export default function DocumentPreview({
  blocks,
  bilingual = false,
  bookId,
  initialPage = 1,
  onPageChange,
  onBackToLibrary,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'translated' | 'untranslated'>('all')
  const [readerMode, setReaderMode] = useState(false)
  const [page, setPage] = useState(initialPage)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const selectionTimer = useRef<NodeJS.Timeout | null>(null)

  // Đồng bộ tiến trình đọc dở khi trang thay đổi
  useEffect(() => {
    if (onPageChange) {
      onPageChange(page)
    }
  }, [page, onPageChange])

  // Cập nhật lại số trang khi mở sách mới
  useEffect(() => {
    setPage(initialPage)
  }, [initialPage, bookId])

  const PER_PAGE = readerMode ? 15 : 20

  const filtered = blocks.filter(b => {
    if (filter === 'translated') return !!b.translatedText || b.type === 'code'
    if (filter === 'untranslated') return !b.translatedText && b.type !== 'code'
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const untranslatedCount = blocks.filter(b => !b.translatedText && b.type !== 'code').length

  // Listen to selection changes to capture highlighted words
  const handleTextSelection = (block: DocumentBlock) => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current)

    // Delay slightly to let the selection complete
    selectionTimer.current = setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const text = sel.toString().trim()
      // Limit selection length to a word or short phrase (1 - 5 words)
      if (!text || text.length > 60 || !/^[a-zA-Z0-9\s'’-]+$/.test(text)) {
        setSelection(null)
        return
      }

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setSelection({
        text,
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top - 45 + window.scrollY,
        context: block.originalText,
        translation: block.translatedText || block.originalText,
      })
    }, 100)
  }

  // Close selection bubble on click outside
  useEffect(() => {
    const handleDocumentClick = () => {
      // Clear selection bubble softly
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || !sel.toString().trim()) {
          setSelection(null)
        }
      }, 50)
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      if (selectionTimer.current) clearTimeout(selectionTimer.current)
    }
  }, [])

  // Save selected word to the SRS Vocabulary Notebook
  const handleSaveSelection = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selection) return

    const savedItem = addVocabItem(selection.text, selection.context, selection.translation)
    if (savedItem) {
      triggerToast(`💾 Đã lưu từ: "${selection.text}" vào Sổ tay!`)
    } else {
      triggerToast(`⚠️ Từ này đã tồn tại trong Sổ tay của bạn.`)
    }

    // Clear selection bubble
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  return (
    <div className="space-y-5 relative">
      {/* Floating Selection Bubble */}
      {selection && (
        <button
          onClick={handleSaveSelection}
          className="absolute z-50 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-xl shadow-blue-500/30 flex items-center gap-1.5 transform -translate-x-1/2 -translate-y-full border border-blue-400/20 transition-all scale-100 animate-in fade-in zoom-in duration-150"
          style={{ left: `${selection.x}px`, top: `${selection.y}px` }}
        >
          <span>💾</span>
          <span>Lưu từ vựng</span>
        </button>
      )}

      {/* Floating Success Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 border border-green-500/30 text-green-300 text-sm font-semibold rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-6 duration-200">
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Control Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          {onBackToLibrary && (
            <button
              onClick={onBackToLibrary}
              className="mr-2 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl border border-white/5 font-bold transition-all shrink-0 active:scale-95 flex items-center gap-1 shadow-md"
            >
              <span>◀</span>
              <span>Thư viện</span>
            </button>
          )}
          <span className="text-gray-400 text-sm font-light">
            Sách có <span className="text-white font-medium">{blocks.length}</span> đoạn văn
          </span>
          {untranslatedCount > 0 && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-full border border-yellow-500/10">
              {untranslatedCount} đoạn chưa dịch
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Mode Switcher */}
          <button
            onClick={() => { setReaderMode(!readerMode); setPage(1) }}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all ${
              readerMode
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25 border border-purple-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
            }`}
          >
            {readerMode ? '📖 Chế độ đọc (ON)' : '📖 Chế độ đọc'}
          </button>

          {/* Filter options (Only in Block Mode) */}
          {!readerMode && (
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5">
              {(['all', 'translated', 'untranslated'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1) }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filter === f ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Tất cả' : f === 'translated' ? 'Đã dịch' : 'Chưa dịch'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {bilingual && (
        <div className="text-xs text-blue-300 bg-blue-500/5 rounded-xl border border-blue-500/10 px-4 py-2.5 font-light flex items-center gap-2">
          <span>💡</span>
          <span>
            {readerMode 
              ? 'Mẹo: Nhấp vào câu tiếng Anh để ẩn/hiện bản dịch tiếng Việt tương ứng bên dưới. Bôi đen từ vựng tiếng Anh để lưu nhanh.'
              : 'Chế độ xem bảng: Bạn có thể click vào bất kỳ câu tiếng Anh nào để làm sáng rõ bản dịch tiếng Việt tương ứng.'
            }
          </span>
        </div>
      )}

      {/* Reader Layout container */}
      <div className={`transition-all duration-300 ${readerMode ? 'max-w-2xl mx-auto px-6 py-4 bg-[#0d1117]/60 rounded-3xl border border-white/5 shadow-inner' : 'space-y-4'}`}>
        {visible.length === 0 ? (
          <p className="text-center text-gray-500 py-10 font-light text-sm">Không tìm thấy nội dung phù hợp bộ lọc.</p>
        ) : (
          visible.map(block => (
            <BlockRow
              key={block.id}
              block={block}
              bilingual={bilingual}
              readerMode={readerMode}
              onTextSelect={handleTextSelection}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 text-xs font-semibold transition-all active:scale-95"
          >
            ← Trước
          </button>
          <span className="text-gray-400 text-xs font-mono font-medium">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 text-xs font-semibold transition-all active:scale-95"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  )
}
