'use client'

import { useState, useEffect } from 'react'

interface Props {
  completed: number
  total: number
  onPause: () => void
  usingCache?: boolean
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `~${mins} phút ${secs}s`
}

export default function TranslationProgress({ completed, total, onPause, usingCache }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const [firstCompletedValue, setFirstCompletedValue] = useState<number | null>(null)
  const [firstChunkTime, setFirstChunkTime] = useState<number | null>(null)
  const [eta, setEta] = useState<number | null>(null)

  useEffect(() => {
    if (completed > 0 && firstCompletedValue === null) {
      setFirstCompletedValue(completed)
      setFirstChunkTime(Date.now())
    }
  }, [completed, firstCompletedValue])

  useEffect(() => {
    if (completed > 0) {
      const remainingItems = total - completed
      if (firstCompletedValue !== null && firstChunkTime !== null && completed > firstCompletedValue) {
        const elapsedMs = Date.now() - firstChunkTime
        const itemsAfterFirst = completed - firstCompletedValue
        const msPerItem = elapsedMs / itemsAfterFirst
        const remainingMs = remainingItems * msPerItem
        setEta(Math.ceil(remainingMs / 1000))
      } else {
        // Ước lượng tạm thời lúc mới khởi động (khoảng 150ms/item cho Gemini 2.5 Flash)
        const estimatedMs = remainingItems * 150
        setEta(Math.ceil(estimatedMs / 1000))
      }
    }
  }, [completed, total, firstCompletedValue, firstChunkTime])

  return (
    <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[18px] p-6 shadow-sm space-y-5 select-none transition-colors duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066cc] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0066cc]"></span>
          </span>
          <span className="text-gray-900 dark:text-white font-bold text-sm tracking-tight">Đang tiến hành dịch thuật...</span>
          {usingCache && (
            <span className="text-[9px] px-2.5 py-0.5 bg-green-500/10 border border-green-500/10 text-green-700 dark:text-green-300 rounded-full font-bold tracking-widest uppercase flex items-center gap-1">
              <span>⚡</span>
              <span>Context Cache (Paid)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#0066cc] dark:text-[#2997ff] font-mono font-bold text-xs bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/10">{pct}%</span>
          <button
            onClick={onPause}
            className="px-5 py-2 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/5 border border-black/10 dark:border-white/5 rounded-full text-xs font-bold transition-all active-scale shadow-sm"
          >
            ⏸ Tạm dừng
          </button>
        </div>
      </div>

      {/* Stunning iPhone Neon Gradient Progress bar */}
      <div className="h-2.5 bg-black/5 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5 shadow-inner">
        <div
          className="h-full bg-iphone-neon rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-gray-600 dark:text-gray-300 text-xs flex items-center justify-between font-light">
        <span>
          Đã hoàn thành <strong className="text-gray-900 dark:text-white font-semibold">{completed}</strong> / <span className="text-gray-400">{total}</span> câu song ngữ
        </span>
        {total > 0 && completed < total && eta !== null && (
          <span className="text-[#0066cc] dark:text-[#2997ff] font-semibold bg-[#0066cc]/5 dark:bg-[#2997ff]/5 border border-[#0066cc]/10 dark:border-[#2997ff]/10 px-3.5 py-1 rounded-full text-[10px] tracking-wide uppercase">
            ⏱ Ước tính còn: {formatTime(eta)}
          </span>
        )}
      </p>

      {/* Compact pulsing dots */}
      <div className="flex gap-1.5 pt-1.5 justify-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-iphone-neon rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, background: i === 0 ? '#0066cc' : i === 1 ? '#5856d6' : '#ff2d55' }}
          />
        ))}
      </div>
    </div>
  )
}
