'use client'

import { useState, useEffect, useRef } from 'react'
import { VocabItem, getVocabItems, deleteVocabItem, evaluateVocabItem } from '@/lib/vocab'

export default function VocabNotebook() {
  const [activeSubTab, setActiveSubTab] = useState<'review' | 'list'>('review')
  const [vocabList, setVocabList] = useState<VocabItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [reviewItems, setReviewItems] = useState<VocabItem[]>([])
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<NodeJS.Timeout | null>(null)

  // Load vocab list on mount or when switching tabs
  const loadVocab = () => {
    const list = getVocabItems()
    setVocabList(list)

    // Filter items that are due for review (nextReview <= now)
    const now = Date.now()
    const due = list.filter(item => item.nextReview <= now)
    // Sort due items so that newer or box 1 items are reviewed first
    due.sort((a, b) => a.box - b.box || a.nextReview - b.nextReview)
    setReviewItems(due)
    setCurrentReviewIndex(0)
    setIsFlipped(false)
  }

  useEffect(() => {
    loadVocab()
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [activeSubTab])

  // Delete word from notebook
  const handleDelete = (id: string) => {
    deleteVocabItem(id)
    loadVocab()
    triggerToast('🗑 Đã xóa từ vựng khỏi sổ tay.')
  }

  // Handle flashcard rating evaluation
  const handleRate = (score: number) => {
    if (reviewItems.length === 0) return
    const currentItem = reviewItems[currentReviewIndex]

    // Evaluate in LocalStorage
    evaluateVocabItem(currentItem.id, score)

    triggerToast(`👍 Đã ghi nhận mức độ nhớ: ${score === 1 ? 'Chưa thuộc' : score === 3 ? 'Tàm tạm' : 'Thuộc lòng'}`)

    // Reset card state and go to next card
    setIsFlipped(false)
    setTimeout(() => {
      if (currentReviewIndex + 1 < reviewItems.length) {
        setCurrentReviewIndex(prev => prev + 1)
      } else {
        // All caught up! Reload to refresh due list
        loadVocab()
      }
    }, 250)
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2500)
  }

  // Helper to highlight selected word in context sentence
  const renderHighlightedContext = (context: string, word: string) => {
    if (!word) return <p className="font-serif text-[17px] leading-relaxed text-gray-800 dark:text-gray-200 text-center">{context}</p>
    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    const parts = context.split(regex)
    return (
      <p className="font-serif text-[17px] leading-relaxed text-gray-800 dark:text-gray-200 text-center">
        {parts.map((part, i) => 
          regex.test(part) 
            ? <span key={i} className="text-pink-600 dark:text-pink-400 font-extrabold border-b-2 border-pink-500/40 px-1 bg-pink-500/5 dark:bg-pink-400/10 rounded">{part}</span> 
            : <span key={i}>{part}</span>
        )}
      </p>
    )
  }

  // Helper to blank out the word for testing recall (Cloze deletion)
  const renderClozeContext = (context: string, word: string) => {
    if (!word) return <p className="font-serif text-[17px] leading-relaxed text-gray-800 dark:text-gray-200 text-center">{context}</p>
    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    return (
      <p className="font-serif text-[17px] leading-relaxed text-gray-800 dark:text-gray-200 text-center">
        {context.split(regex).map((part, i) => 
          regex.test(part) 
            ? <span key={i} className="text-[#0066cc] dark:text-[#2997ff] font-extrabold border-b-2 border-blue-500/40 px-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-md tracking-wider">_______</span> 
            : <span key={i}>{part}</span>
        )}
      </p>
    )
  }

  // Filter word list based on search query
  const filteredVocabList = vocabList.filter(item => 
    item.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.context.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const currentItem = reviewItems[currentReviewIndex]

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification (Apple Floating Toast) */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-[#fafafc] dark:bg-[#272729] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-6 duration-200 select-none">
          <span>💡</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sub Tabs Navigation (Segmented Capsule Bar) */}
      <div className="flex bg-black/5 dark:bg-black/35 p-1 rounded-full border border-black/5 dark:border-white/5 max-w-md mx-auto shadow-inner relative z-10 select-none">
        <button
          onClick={() => setActiveSubTab('review')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-bold transition-all active-scale ${
            activeSubTab === 'review'
              ? 'bg-iphone-neon text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>📇</span>
          <span>Ôn tập ({reviewItems.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-bold transition-all active-scale ${
            activeSubTab === 'list'
              ? 'bg-iphone-neon text-white shadow-md'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>📚</span>
          <span>Từ vựng ({vocabList.length})</span>
        </button>
      </div>

      {/* Tab 1: Spaced Repetition Flashcards review */}
      {activeSubTab === 'review' && (
        <div className="max-w-xl mx-auto space-y-6">
          {reviewItems.length === 0 ? (
            // Completed State (Elegant Capsule Screen)
            <div className="relative bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[28px] p-10 text-center space-y-4 shadow-sm overflow-hidden select-none">
              {/* Radiant ambient Siri gradient ring */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-iphone-ambient-glow dark:bg-iphone-ambient-glow blur-2xl opacity-60 pointer-events-none -z-10 animate-pulse" />
              
              <span className="text-5xl inline-block animate-bounce">🎉</span>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold tracking-tight apple-font-display text-gray-900 dark:text-white">HOÀN THÀNH ÔN TẬP!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto font-light leading-relaxed">
                  Tuyệt vời! Toàn bộ từ vựng cần học hôm nay đã được hoàn thành. Hãy tiếp tục đọc sách và lưu thêm các từ mới.
                </p>
              </div>
              <div className="pt-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono font-bold uppercase tracking-wider">
                Tổng từ vựng đang có: {vocabList.length} từ
              </div>
            </div>
          ) : (
            // Reviewing State
            <div className="space-y-6">
              {/* Progress bar */}
              <div className="space-y-2 select-none">
                <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-mono font-bold uppercase tracking-wider px-1">
                  <span>Tiến trình ôn tập</span>
                  <span>{currentReviewIndex + 1} / {reviewItems.length} từ</span>
                </div>
                <div className="h-2 bg-black/5 dark:bg-black/35 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5 shadow-inner">
                  <div 
                    className="h-full bg-iphone-neon rounded-full transition-all duration-300"
                    style={{ width: `${((currentReviewIndex + 1) / reviewItems.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Interactive Flashcard with True 3D Flip Effect */}
              <div className="relative w-full max-w-xl mx-auto h-[320px] select-none" style={{ perspective: '1500px' }}>
                {/* Ambient Siri-like backdrop light */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-iphone-ambient-glow blur-2xl opacity-75 pointer-events-none -z-10 animate-pulse" />

                {/* 3D Flip Card Chassis */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full h-full cursor-pointer relative rounded-[28px] shadow-2xl transition-transform duration-700 ease-out border border-black/5 dark:border-white/10"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* FRONT SIDE (Cloze recall test) */}
                  <div 
                    className="absolute inset-0 w-full h-full rounded-[28px] p-8 flex flex-col justify-between items-center bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    {/* Top row badge */}
                    <div className="w-full flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-widest font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold border border-blue-500/15">
                        Thử thách ghi nhớ
                      </span>
                      <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500">
                        HỘP {currentItem.box}
                      </span>
                    </div>
                    
                    {/* Word display */}
                    <div className="space-y-4 w-full text-center">
                      <h2 className="text-4xl font-extrabold tracking-tighter apple-font-display bg-iphone-neon bg-clip-text text-transparent py-1">
                        {currentItem.word}
                      </h2>
                      <div className="bg-[#f5f5f7] dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-5 shadow-inner">
                        {renderClozeContext(currentItem.context, currentItem.word)}
                      </div>
                    </div>

                    {/* Hint Label */}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold flex items-center gap-1.5 animate-pulse">
                      <span>💡</span>
                      <span>Chạm vào thẻ để lật xem nghĩa &amp; đáp án</span>
                    </div>
                  </div>

                  {/* BACK SIDE (Solution & details) */}
                  <div 
                    className="absolute inset-0 w-full h-full rounded-[28px] p-8 flex flex-col justify-between items-center bg-[#fafafc] dark:bg-[#121214] border border-indigo-500/10 text-gray-900 dark:text-white"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {/* Top row badge */}
                    <div className="w-full flex justify-between items-center">
                      <span className="text-[9px] uppercase tracking-widest font-mono bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-0.5 rounded-full font-bold border border-green-500/15">
                        Đáp án &amp; Chi tiết
                      </span>
                      <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500">
                        HỘP {currentItem.box}
                      </span>
                    </div>

                    {/* Solutions details */}
                    <div className="space-y-4 w-full">
                      <div className="bg-[#f5f5f7] dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-inner">
                        {renderHighlightedContext(currentItem.context, currentItem.word)}
                      </div>
                      <div className="bg-[#0066cc]/5 dark:bg-indigo-500/5 border border-[#0066cc]/10 dark:border-indigo-500/10 rounded-2xl p-4 text-center">
                        <p className="text-[15px] font-serif italic text-gray-800 dark:text-indigo-200/95 leading-relaxed">
                          {currentItem.translation}
                        </p>
                      </div>
                    </div>

                    {/* Hint Label */}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Hãy tự đánh giá mức độ thuộc phía dưới</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spaced repetition rating controls (Appears when flipped) */}
              <div 
                className={`grid grid-cols-3 gap-3 select-none transition-all duration-300 transform ${
                  isFlipped ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                <button
                  onClick={() => handleRate(1)}
                  className="flex flex-col items-center gap-0.5 py-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-600 dark:text-red-300 rounded-[20px] font-bold text-xs transition-all active-scale"
                >
                  <span>😢 Chưa thuộc</span>
                  <span className="text-[9px] font-normal text-red-500/70 dark:text-red-400/80">Học lại ngày mai</span>
                </button>
                <button
                  onClick={() => handleRate(3)}
                  className="flex flex-col items-center gap-0.5 py-3 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded-[20px] font-bold text-xs transition-all active-scale"
                >
                  <span>😐 Tàm tạm</span>
                  <span className="text-[9px] font-normal text-yellow-600/70 dark:text-yellow-400/80">Ôn lại sớm</span>
                </button>
                <button
                  onClick={() => handleRate(5)}
                  className="flex flex-col items-center gap-0.5 py-3 bg-green-500/10 hover:bg-green-500/15 border border-green-500/20 text-green-600 dark:text-green-300 rounded-[20px] font-bold text-xs transition-all active-scale"
                >
                  <span>😊 Thuộc lòng</span>
                  <span className="text-[9px] font-normal text-green-600/70 dark:text-green-400/80">Tăng giãn cách</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Word List and Management */}
      {activeSubTab === 'list' && (
        <div className="space-y-5">
          {/* Search bar (Apple Style Pill Input) */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm kiếm từ vựng hoặc ngữ cảnh..."
              className="w-full bg-[#f5f5f7] dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-full px-5 py-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0066cc] placeholder-gray-400 dark:placeholder-gray-500 shadow-inner"
            />
          </div>

          {/* List items */}
          {filteredVocabList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 font-light text-sm select-none">
              {searchQuery ? 'Không tìm thấy từ vựng nào khớp.' : 'Sổ tay hiện đang trống. Hãy bôi đen lưu từ mới khi đọc sách!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVocabList.map(item => {
                const reviewDate = new Date(item.nextReview)
                const isDue = item.nextReview <= Date.now()
                return (
                  <div 
                    key={item.id}
                    className="relative overflow-hidden border border-black/5 dark:border-white/5 rounded-[22px] p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-black/10 dark:hover:border-white/10 transition-all duration-300"
                    style={{ background: 'linear-gradient(to bottom, #d2e9ff 0%, #ffffff 100%)' }}
                  >
                    {/* Top line with word details & delete */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white apple-font-display">
                          {item.word}
                        </h3>
                        <div className="flex gap-2 items-center select-none">
                          <span className="text-[8px] bg-iphone-neon text-white px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
                            Hộp {item.box}
                          </span>
                          <span className={`text-[8px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide border ${
                            isDue 
                              ? 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/15 animate-pulse' 
                              : 'bg-black/5 dark:bg-white/5 text-gray-400 dark:text-gray-500 border-black/5 dark:border-white/5'
                          }`}>
                            {isDue ? 'Cần ôn ngay' : 'Chưa đến hạn'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-red-500/10 dark:hover:bg-red-500/15 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full border border-black/5 dark:border-white/5 font-bold transition-all active-scale select-none shrink-0"
                      >
                        🗑 Xóa
                      </button>
                    </div>

                    {/* Highlighted context sections */}
                    <div className="space-y-2 border-t border-black/5 dark:border-white/5 pt-3">
                      <div className="font-serif text-[14px] leading-relaxed italic text-gray-600 dark:text-gray-400">
                        {/* Highlights word in normal list layout */}
                        {item.context.split(new RegExp(`\\b(${item.word})\\b`, 'gi')).map((part, index) => 
                          new RegExp(`\\b(${item.word})\\b`, 'gi').test(part)
                            ? <strong key={index} className="text-[#0066cc] dark:text-[#2997ff] font-extrabold">{part}</strong>
                            : <span key={index}>{part}</span>
                        )}
                      </div>
                      <p className="text-[13px] font-serif leading-relaxed text-[#0066cc] dark:text-indigo-300">
                        {item.translation}
                      </p>
                    </div>

                    {/* Spaced repetition review timestamp footer */}
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 font-mono font-semibold text-right select-none">
                      Ôn tiếp: {reviewDate.toLocaleDateString('vi-VN')} {reviewDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
