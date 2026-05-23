'use client'

import { useState, useEffect } from 'react'
import { VocabItem, getVocabItems, deleteVocabItem, evaluateVocabItem } from '@/lib/vocab'

export default function VocabNotebook() {
  const [activeSubTab, setActiveSubTab] = useState<'review' | 'list'>('review')
  const [vocabList, setVocabList] = useState<VocabItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [reviewItems, setReviewItems] = useState<VocabItem[]>([])
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

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

    triggerToast(`👍 Đã lưu đánh giá mức độ nhớ: ${score === 1 ? 'Quên' : score === 3 ? 'Trung bình' : 'Nhớ rõ'}`)

    // Reset card state and go to next card
    setIsFlipped(false)
    setTimeout(() => {
      if (currentReviewIndex + 1 < reviewItems.length) {
        setCurrentReviewIndex(prev => prev + 1)
      } else {
        // All caught up! Reload to refresh due list
        loadVocab()
      }
    }, 150)
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // Helper to highlight selected word in context sentence
  const renderHighlightedContext = (context: string, word: string) => {
    if (!word) return context
    // Case-insensitive regex match
    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    const parts = context.split(regex)
    return (
      <p className="font-serif text-lg leading-relaxed text-gray-200 text-center">
        {parts.map((part, i) => 
          regex.test(part) 
            ? <span key={i} className="text-yellow-400 font-bold border-b-2 border-yellow-400/30 px-1 bg-yellow-400/5 rounded">{part}</span> 
            : <span key={i}>{part}</span>
        )}
      </p>
    )
  }

  // Helper to blank out the word for testing recall (Cloze deletion)
  const renderClozeContext = (context: string, word: string) => {
    if (!word) return context
    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    return (
      <p className="font-serif text-lg leading-relaxed text-gray-200 text-center">
        {context.split(regex).map((part, i) => 
          regex.test(part) 
            ? <span key={i} className="text-blue-400 font-bold border-b-2 border-blue-400/40 px-3 bg-blue-500/10 rounded-md tracking-wider">_______</span> 
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
  const boxes = [1, 2, 3, 4, 5]

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 border border-blue-500/30 text-blue-300 text-sm font-semibold rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-6 duration-200">
          <span>💡</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 max-w-md mx-auto shadow-md">
        <button
          onClick={() => setActiveSubTab('review')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'review'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>📇</span>
          <span>Ôn tập Flashcards ({reviewItems.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'list'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>📚</span>
          <span>Danh sách từ vựng ({vocabList.length})</span>
        </button>
      </div>

      {/* Tab 1: Spaced Repetition Flashcards review */}
      {activeSubTab === 'review' && (
        <div className="max-w-xl mx-auto space-y-6">
          {reviewItems.length === 0 ? (
            // Empty / Completed state
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center space-y-4 shadow-xl">
              <span className="text-5xl inline-block animate-bounce">🎉</span>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white tracking-wide">BẠN ĐÃ HOÀN THÀNH ÔN TẬP!</h3>
                <p className="text-gray-400 text-sm max-w-sm mx-auto font-light leading-relaxed">
                  Tuyệt vời! Toàn bộ từ vựng cần ôn tập hôm nay đã được hoàn thành. Hãy tiếp tục đọc sách và bôi đen lưu từ mới.
                </p>
              </div>
              <div className="pt-2 text-xs text-gray-500 font-mono">
                Tổng số từ đang sở hữu: {vocabList.length} từ
              </div>
            </div>
          ) : (
            // Reviewing state
            <div className="space-y-6">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-gray-400 font-mono font-medium px-1">
                  <span>Tiến trình ôn tập</span>
                  <span>{currentReviewIndex + 1} / {reviewItems.length} từ</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${((currentReviewIndex + 1) / reviewItems.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Interactive Flashcard with Flip Effect */}
              <div className="perspective-1000 w-full min-h-[280px]">
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`w-full min-h-[280px] cursor-pointer rounded-3xl border transition-all duration-500 transform-style-3d p-8 shadow-2xl relative flex flex-col justify-between items-center ${
                    isFlipped 
                      ? 'rotate-y-180 bg-indigo-950/40 border-indigo-500/30' 
                      : 'bg-white/5 border-white/10 hover:border-white/15'
                  }`}
                >
                  {/* Front of the Card */}
                  {!isFlipped ? (
                    <div className="w-full h-full flex flex-col justify-between items-center space-y-6 backface-hidden">
                      <div className="text-[10px] text-blue-400 uppercase tracking-widest font-bold bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                        Mặt trước: Thử thách ghi nhớ
                      </div>
                      
                      <div className="space-y-4 w-full">
                        {/* Selected word */}
                        <h2 className="text-3xl font-extrabold text-white text-center tracking-tight">
                          {currentItem.word}
                        </h2>
                        {/* Cloze deletion sentence context */}
                        <div className="bg-black/10 border border-white/5 rounded-2xl p-4 shadow-inner">
                          {renderClozeContext(currentItem.context, currentItem.word)}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 italic animate-pulse">
                        💡 Click để lật thẻ xem đáp án &amp; nghĩa
                      </div>
                    </div>
                  ) : (
                    // Back of the Card
                    <div className="w-full h-full flex flex-col justify-between items-center space-y-6 rotate-y-180 backface-hidden">
                      <div className="text-[10px] text-green-400 uppercase tracking-widest font-bold bg-green-500/10 px-2.5 py-0.5 rounded-full border border-green-500/20">
                        Mặt sau: Đáp án &amp; Nghĩa
                      </div>

                      <div className="space-y-4 w-full">
                        {/* Original English sentence with highlight */}
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                          {renderHighlightedContext(currentItem.context, currentItem.word)}
                        </div>
                        {/* Vietnamese translation of the context */}
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 text-center">
                          <p className="text-sm font-medium text-indigo-200/90 leading-relaxed font-serif">
                            {currentItem.translation}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 italic">
                        💡 Hãy tự đánh giá mức độ thuộc phía dưới
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rating controls (Only shown after flipping to the back) */}
              {isFlipped && (
                <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <button
                    onClick={() => handleRate(1)}
                    className="flex flex-col items-center gap-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-2xl font-bold text-xs transition-all active:scale-95 hover:shadow-lg hover:shadow-red-500/5"
                  >
                    <span>😢 Quên</span>
                    <span className="text-[9px] font-normal text-red-400/80">Học lại ngày mai</span>
                  </button>
                  <button
                    onClick={() => handleRate(3)}
                    className="flex flex-col items-center gap-1 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-300 rounded-2xl font-bold text-xs transition-all active:scale-95 hover:shadow-lg hover:shadow-yellow-500/5"
                  >
                    <span>😐 Khá khó</span>
                    <span className="text-[9px] font-normal text-yellow-400/80">Ôn lại sớm</span>
                  </button>
                  <button
                    onClick={() => handleRate(5)}
                    className="flex flex-col items-center gap-1 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 rounded-2xl font-bold text-xs transition-all active:scale-95 hover:shadow-lg hover:shadow-green-500/5"
                  >
                    <span>😊 Nhớ rõ</span>
                    <span className="text-[9px] font-normal text-green-400/80">Tăng khoảng cách</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Word List and Management */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm kiếm từ vựng hoặc ngữ cảnh..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500 shadow-inner"
            />
          </div>

          {/* List items */}
          {filteredVocabList.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-light text-sm">
              {searchQuery ? 'Không tìm thấy từ vựng nào khớp.' : 'Sổ tay từ vựng hiện đang trống. Hãy bôi đen lưu từ khi đọc sách!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVocabList.map(item => {
                const reviewDate = new Date(item.nextReview)
                const isDue = item.nextReview <= Date.now()
                return (
                  <div 
                    key={item.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-md hover:border-white/15 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-bold text-white tracking-tight">{item.word}</h3>
                        <div className="flex gap-2 items-center">
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/10 font-bold uppercase">Hộp {item.box}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${
                            isDue 
                              ? 'bg-red-500/10 text-red-300 border-red-500/10 animate-pulse' 
                              : 'bg-white/5 text-gray-400 border-white/5'
                          }`}>
                            {isDue ? 'Cần ôn ngay' : 'Đã ôn tập'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 bg-white/5 hover:bg-red-500/10 rounded-lg border border-white/5 transition-all"
                      >
                        🗑 Xóa
                      </button>
                    </div>

                    <div className="space-y-1.5 border-t border-white/5 pt-2">
                      <p className="text-xs text-gray-400 font-serif leading-relaxed italic">{item.context}</p>
                      <p className="text-xs text-indigo-300 font-serif leading-relaxed">{item.translation}</p>
                    </div>

                    <div className="text-[9px] text-gray-500 font-mono text-right">
                      Lịch ôn kế tiếp: {reviewDate.toLocaleDateString('vi-VN')} {reviewDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
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
