'use client'

import { useState, useEffect } from 'react'

interface Props {
  completed: number
  total: number
  onPause: () => void
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `~${mins} phút ${secs}s`
}

export default function TranslationProgress({ completed, total, onPause }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const [startTime] = useState(() => Date.now())
  const [eta, setEta] = useState<number | null>(null)

  useEffect(() => {
    if (completed > 10) { // Đợi dịch được một vài block để tính toán tốc độ chính xác hơn
      const elapsedMs = Date.now() - startTime
      const msPerItem = elapsedMs / completed
      const remainingItems = total - completed
      const remainingMs = remainingItems * msPerItem
      setEta(Math.ceil(remainingMs / 1000))
    } else if (completed > 0) {
      // Ước lượng tạm thời lúc mới khởi động
      const remainingItems = total - completed
      const estimatedMs = remainingItems * 80 // Mỗi block dịch ~80ms (đã tối ưu hóa)
      setEta(Math.ceil(estimatedMs / 1000))
    }
  }, [completed, total, startTime])

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          <span className="text-white font-semibold tracking-wide">Đang dịch sách...</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-400 font-mono font-bold text-sm bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">{pct}%</span>
          <button
            onClick={onPause}
            className="px-4 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white text-xs rounded-xl font-semibold shadow-lg shadow-yellow-600/15 transition-all duration-300 transform active:scale-95"
          >
            ⏸ Tạm dừng
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-gray-300 text-sm flex items-center justify-between font-light">
        <span>
          Đã hoàn thành <span className="text-white font-medium">{completed}</span> / <span className="text-gray-400 font-medium">{total}</span> câu
        </span>
        {total > 0 && completed < total && eta !== null && (
          <span className="text-blue-300 font-medium bg-blue-500/5 border border-blue-500/10 px-3 py-1 rounded-lg text-xs backdrop-blur-md">
            ⏱ Thời gian còn lại: {formatTime(eta)}
          </span>
        )}
      </p>

      {/* Animated dots */}
      <div className="flex gap-1.5 pt-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-gradient-to-tr from-blue-400 to-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
