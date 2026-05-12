'use client'

interface Props {
  completed: number
  total: number
}

export default function TranslationProgress({ completed, total }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-medium">Đang dịch...</span>
        <span className="text-blue-400 font-mono text-sm">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-gray-400 text-sm mt-3">
        {completed} / {total} đoạn văn đã dịch
        {total > 0 && completed < total && (
          <span className="ml-2 text-gray-500">
            · Còn lại ~{Math.ceil(((total - completed) / Math.max(completed, 1)) * (completed * 2))}s
          </span>
        )}
      </p>

      {/* Animated dots */}
      <div className="flex gap-1.5 mt-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
