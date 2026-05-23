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
  onWordDoubleClick,
}: {
  block: DocumentBlock
  bilingual: boolean
  readerMode: boolean
  onTextSelect: (block: DocumentBlock) => void
  onWordDoubleClick: (word: string, block: DocumentBlock) => void
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

  // Handle double-clicking on a word to prompt lookup
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sel = window.getSelection()
    if (!sel) return
    const text = sel.toString().trim()
    
    // Validate that a single word or small phrase is selected
    if (text && text.length < 50 && /^[a-zA-Z0-9\s'’-]+$/.test(text)) {
      onWordDoubleClick(text, block)
    }
  }

  // Handle bilingual rendering
  if (bilingual && block.translatedText) {
    const isHeading = block.type === 'heading'
    const lvl = block.style.level || 1

    if (readerMode) {
      // Vintage Book Page Layout (Bilingual)
      return (
        <div 
          className="py-3 border-b border-black/5 group select-text"
          onMouseUp={() => onTextSelect(block)}
        >
          {isHeading ? (
            <h3 
              onClick={handleToggleReveal}
              onDoubleClick={handleDoubleClick}
              className={`font-serif font-bold text-[#2d1f10] tracking-tight cursor-pointer hover:text-blue-700 transition-colors leading-tight ${
                lvl === 1 ? 'text-xl mt-4 mb-1.5' : lvl === 2 ? 'text-lg mt-3 mb-1.5' : 'text-base mt-2 mb-1'
              }`}
            >
              {block.translatedText}
            </h3>
          ) : (
            <div className="space-y-1.5">
              <p 
                onClick={handleToggleReveal}
                onDoubleClick={handleDoubleClick}
                className="font-serif text-[15px] leading-relaxed text-[#382613] cursor-pointer hover:text-blue-800 transition-colors select-text"
              >
                {block.originalText}
              </p>
              <p 
                onClick={handleToggleReveal}
                className={`font-serif text-[14px] leading-relaxed text-indigo-900/85 italic whitespace-pre-wrap transition-all duration-300 origin-top transform ${
                  revealed 
                    ? 'opacity-100 scale-100 max-h-[500px] blur-0' 
                    : 'opacity-10 scale-[0.99] max-h-[22px] blur-[3px] select-none'
                }`}
              >
                {block.translatedText}
              </p>
            </div>
          )}
        </div>
      )
    }

    // Block Mode Layout (Bilingual - when reader mode is OFF)
    return (
      <div 
        className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-md space-y-2 select-text hover:border-white/15 transition-all"
        onMouseUp={() => onTextSelect(block)}
      >
        <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-white/5 pb-1">
          <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">
            {TYPE_BADGE[block.type] || 'P'}{lvl ? lvl : ''}
          </span>
          <span className="italic">💡 Nhấp đúp vào từ tiếng Anh để tra nghĩa nhanh</span>
        </div>
        <div className="space-y-1.5 cursor-pointer" onClick={handleToggleReveal}>
          <p 
            onDoubleClick={handleDoubleClick}
            className="text-sm text-gray-400 font-light leading-relaxed whitespace-pre-wrap select-text"
          >
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
        <pre className="bg-black/5 border border-black/10 rounded-lg p-3 font-mono text-xs text-emerald-800 my-3 overflow-x-auto">
          <code>{block.originalText}</code>
        </pre>
      )
    }
    const lvl = block.style.level || 1
    return (
      <div className="py-2.5 font-serif select-text">
        {block.type === 'heading' ? (
          <h3 
            onDoubleClick={handleDoubleClick}
            className={`font-bold text-[#2d1f10] ${lvl === 1 ? 'text-xl mt-4' : lvl === 2 ? 'text-lg mt-3' : 'text-base mt-2'}`}
          >
            {block.translatedText || block.originalText}
          </h3>
        ) : (
          <p 
            onDoubleClick={handleDoubleClick}
            className="text-[15px] leading-relaxed text-[#382613] select-text"
          >
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
          onDoubleClick={handleDoubleClick}
          className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap select-text ${
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
  const [readerMode, setReaderMode] = useState(true) // Default to reader mode!
  const [page, setPage] = useState(initialPage)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const selectionTimer = useRef<NodeJS.Timeout | null>(null)

  // Vintage Book Title
  const [bookTitle, setBookTitle] = useState('Đọc Sách Song Ngữ')

  // Animation Flip State
  const [flipClass, setFlipClass] = useState('')

  // Double Click Dictionary States
  const [lookupWord, setLookupWord] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<{ word: string; ipa: string; meaning: string } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupContext, setLookupContext] = useState<DocumentBlock | null>(null)

  // Fetch real book title from Library
  useEffect(() => {
    if (bookId) {
      try {
        const savedBooks = localStorage.getItem('dich-sach-library-books')
        if (savedBooks) {
          const parsed = JSON.parse(savedBooks)
          const book = parsed.find((b: any) => b.id === bookId)
          if (book) {
            setBookTitle(book.title)
          }
        }
      } catch (err) {
        console.error('Error fetching book metadata:', err)
      }
    }
  }, [bookId])

  // Synchronize reading progress on page change
  useEffect(() => {
    if (onPageChange) {
      onPageChange(page)
    }
  }, [page, onPageChange])

  // Reset page index on opening a new book
  useEffect(() => {
    setPage(initialPage)
  }, [initialPage, bookId])

  // Number of blocks per book page (fits beautiful layout perfectly!)
  const PER_BOOK_PAGE = 6
  const PER_PAGE_DEFAULT = 20

  const filtered = blocks.filter(b => {
    if (filter === 'translated') return !!b.translatedText || b.type === 'code'
    if (filter === 'untranslated') return !b.translatedText && b.type !== 'code'
    return true
  })

  // Book pages count
  const totalPages = Math.ceil(filtered.length / PER_BOOK_PAGE)
  const untranslatedCount = blocks.filter(b => !b.translatedText && b.type !== 'code').length

  // Visible lists in standard list view
  const visible = filtered.slice((page - 1) * PER_PAGE_DEFAULT, page * PER_PAGE_DEFAULT)
  const standardTotalPages = Math.ceil(filtered.length / PER_PAGE_DEFAULT)

  // Left & Right visible pages in Book View
  const leftVisible = filtered.slice((page - 1) * PER_BOOK_PAGE, page * PER_BOOK_PAGE)
  const rightVisible = filtered.slice(page * PER_BOOK_PAGE, (page + 1) * PER_BOOK_PAGE)

  // Get active chapter heading helper
  const getActiveChapter = (indexLimit: number) => {
    for (let i = indexLimit; i >= 0; i--) {
      if (filtered[i]?.type === 'heading') {
        return filtered[i].originalText
      }
    }
    return 'Phần mở đầu'
  }

  // Handle page turns with beautiful 3D flip animation
  const handleNextPage = () => {
    if (page + 1 >= totalPages || flipClass !== '') return
    setFlipClass('animate-flip-next')
    setTimeout(() => {
      setPage(p => Math.min(totalPages, p + 2))
      setFlipClass('')
    }, 450)
  }

  const handlePrevPage = () => {
    if (page === 1 || flipClass !== '') return
    setFlipClass('animate-flip-prev')
    setTimeout(() => {
      setPage(p => Math.max(1, p - 2))
      setFlipClass('')
    }, 450)
  }

  // Double click lookup logic
  const handleWordDoubleClick = async (word: string, block: DocumentBlock) => {
    const cleanedWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"“”’‘]/g, "").trim()
    if (!cleanedWord) return
    
    setLookupWord(cleanedWord)
    setLookupContext(block)
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)

    try {
      const savedConfig = localStorage.getItem('dich-viet-api-config')
      const config = savedConfig ? JSON.parse(savedConfig) : null

      const res = await fetch('/api/dict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: cleanedWord, config }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Lỗi kết nối hoặc API hết lượt truy vấn')
      }

      const data = await res.json()
      setLookupResult(data)
    } catch (err: any) {
      setLookupError(err.message || 'Không thể tra từ điển AI')
    } finally {
      setLookupLoading(false)
    }
  }

  // Listen to selection changes to capture highlighted words
  const handleTextSelection = (block: DocumentBlock) => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current)

    selectionTimer.current = setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const text = sel.toString().trim()
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

    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  return (
    <div className="space-y-5 relative">
      {/* Floating Selection Bubble (Mouse drag select) */}
      {selection && (
        <button
          onClick={handleSaveSelection}
          className="absolute z-40 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-xl shadow-blue-500/30 flex items-center gap-1.5 transform -translate-x-1/2 -translate-y-full border border-blue-400/20 transition-all scale-100 animate-in fade-in zoom-in duration-150"
          style={{ left: `${selection.x}px`, top: `${selection.y}px` }}
        >
          <span>💾</span>
          <span>Lưu từ vựng</span>
        </button>
      )}

      {/* Double Click Dictionary Lookup Popup */}
      {lookupWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm dict-popup-overlay">
          <div className="relative w-full max-w-sm rounded-3xl p-6 border border-indigo-100/30 dict-popup-content space-y-4">
            {/* Close Button */}
            <button
              onClick={() => setLookupWord(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            >
              ✕
            </button>

            {lookupLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3">
                <span className="text-3xl animate-spin">🌀</span>
                <p className="text-xs text-slate-500 font-light">Đang tra cứu từ điển AI...</p>
              </div>
            ) : lookupError ? (
              <div className="py-4 space-y-3">
                <div className="text-center text-3xl">⚠️</div>
                <p className="text-sm text-red-500 text-center font-medium leading-relaxed">{lookupError}</p>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => handleWordDoubleClick(lookupWord, lookupContext!)}
                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                  >
                    Thử lại
                  </button>
                </div>
              </div>
            ) : lookupResult ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                    Từ vựng mới
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <h4 className="text-2xl font-serif font-bold text-slate-900 leading-none">
                      {lookupResult.word}
                    </h4>
                    <button
                      onClick={() => {
                        const utterance = new SpeechSynthesisUtterance(lookupResult.word)
                        utterance.lang = 'en-US'
                        window.speechSynthesis.speak(utterance)
                      }}
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors active:scale-90"
                      title="Phát âm tiếng Anh"
                    >
                      🔊
                    </button>
                  </div>
                  {lookupResult.ipa && (
                    <p className="text-sm font-mono text-indigo-600 font-semibold">
                      {lookupResult.ipa}
                    </p>
                  )}
                </div>

                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50">
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mb-1">Nghĩa tiếng Việt</span>
                  <p className="text-sm text-slate-700 leading-relaxed font-serif">
                    {lookupResult.meaning}
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (lookupContext) {
                      const added = addVocabItem(
                        lookupResult.word, 
                        lookupContext.originalText, 
                        lookupContext.translatedText || lookupContext.originalText
                      )
                      if (added) {
                        triggerToast(`💾 Đã lưu từ: "${lookupResult.word}" vào Sổ tay!`)
                      } else {
                        triggerToast(`⚠️ Từ này đã tồn tại trong Sổ tay của bạn.`)
                      }
                      setLookupWord(null)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl border border-blue-400/20 shadow-lg shadow-blue-500/15 transition-all active:scale-95"
                >
                  <span>📓</span>
                  <span>Thêm vào Sổ tay từ vựng</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
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
            {readerMode ? '📖 Chế độ đọc cổ điển (ON)' : '📖 Chế độ đọc cổ điển'}
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
              ? 'Chế độ lật trang sách cổ điển: Nhấp đúp vào bất kỳ từ tiếng Anh nào để xem nghĩa và phiên âm IPA. Bôi đen để lưu cụm từ.'
              : 'Chế độ cuộn dọc: Bạn có thể click vào câu tiếng Anh để làm sáng rõ bản dịch tiếng Việt tương ứng.'
            }
          </span>
        </div>
      )}

      {/* Reader Layout container */}
      {readerMode ? (
        <div className="book-wrapper">
          <div className="real-book">
            {/* Spine Crease shadow fold */}
            <div className="book-spine" />
            
            {/* Shaded multi-page stacked paper edges */}
            <div className="book-stack-left" />
            <div className="book-stack-right" />

            {/* LEFT BOOK PAGE */}
            <div className={`real-book-page real-book-page-left ${flipClass}`}>
              {/* Corner Ornaments */}
              <div className="vintage-ornament vintage-ornament-tl" />
              <div className="vintage-ornament vintage-ornament-bl" />
              
              {/* Running Header */}
              <div className="vintage-page-header">
                {bookTitle}
              </div>

              {/* Page Content blocks list */}
              <div className="flex-1 flex flex-col justify-start space-y-3 pt-3 select-text">
                {leftVisible.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[#7d6b58] italic font-serif">
                    Kết thúc nội dung sách.
                  </div>
                ) : (
                  leftVisible.map(block => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      bilingual={bilingual}
                      readerMode={true}
                      onTextSelect={handleTextSelection}
                      onWordDoubleClick={handleWordDoubleClick}
                    />
                  ))
                )}
              </div>

              {/* Footer containing Page Number aligned near Spine fold */}
              <div className="vintage-page-footer right-[20px] flex justify-end">
                <span>{page * 2 - 1}</span>
              </div>
            </div>

            {/* RIGHT BOOK PAGE */}
            <div className={`real-book-page real-book-page-right ${flipClass}`}>
              {/* Corner Ornaments */}
              <div className="vintage-ornament vintage-ornament-tr" />
              <div className="vintage-ornament vintage-ornament-br" />

              {/* Running Header */}
              <div className="vintage-page-header">
                {getActiveChapter(Math.min(filtered.length - 1, page * PER_BOOK_PAGE))}
              </div>

              {/* Page Content blocks list */}
              <div className="flex-1 flex flex-col justify-start space-y-3 pt-3 select-text">
                {rightVisible.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[#7d6b58] italic font-serif">
                    Kết thúc nội dung sách.
                  </div>
                ) : (
                  rightVisible.map(block => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      bilingual={bilingual}
                      readerMode={true}
                      onTextSelect={handleTextSelection}
                      onWordDoubleClick={handleWordDoubleClick}
                    />
                  ))
                )}
              </div>

              {/* Footer containing Page Number aligned near Spine fold */}
              <div className="vintage-page-footer left-[20px] flex justify-start">
                <span>{page * 2}</span>
              </div>
            </div>
          </div>

          {/* Book navigation control buttons */}
          <div className="flex justify-between items-center mt-5 max-w-[1080px] mx-auto px-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || flipClass !== ''}
              className="px-6 py-2.5 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed border border-white/5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md"
            >
              <span>◀</span>
              <span>Trang trước</span>
            </button>

            <span className="text-xs text-gray-400 font-mono font-bold">
              Trang {page * 2 - 1} - {page * 2} / {totalPages * 2}
            </span>

            <button
              onClick={handleNextPage}
              disabled={page + 1 >= totalPages || rightVisible.length === 0 || flipClass !== ''}
              className="px-6 py-2.5 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed border border-white/5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md"
            >
              <span>Trang tiếp</span>
              <span>▶</span>
            </button>
          </div>
        </div>
      ) : (
        /* Original vertical scrolling list mode */
        <>
          <div className="space-y-4">
            {visible.length === 0 ? (
              <p className="text-center text-gray-500 py-10 font-light text-sm">Không tìm thấy nội dung phù hợp bộ lọc.</p>
            ) : (
              visible.map(block => (
                <BlockRow
                  key={block.id}
                  block={block}
                  bilingual={bilingual}
                  readerMode={false}
                  onTextSelect={handleTextSelection}
                  onWordDoubleClick={handleWordDoubleClick}
                />
              ))
            )}
          </div>

          {/* List pagination */}
          {standardTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 text-xs font-semibold transition-all active:scale-95"
              >
                ← Trước
              </button>
              <span className="text-gray-400 text-xs font-mono font-medium">
                Trang {page} / {standardTotalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(standardTotalPages, p + 1))}
                disabled={page === standardTotalPages}
                className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 text-xs font-semibold transition-all active:scale-95"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
