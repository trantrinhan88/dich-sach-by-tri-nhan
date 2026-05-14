'use client'

import { useState, useEffect } from 'react'
import { AIProvider, TranslationConfig } from '@/lib/types'

const PROVIDERS: { value: AIProvider; label: string; models: string[]; placeholder: string }[] = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    placeholder: 'sk-...',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIza...',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    placeholder: 'sk-...',
  },
]

interface Props {
  onConfigChange: (config: TranslationConfig | null) => void
}

const LS_KEY = 'dich-viet-api-config'

export default function ApiConfig({ onConfigChange }: Props) {
  const [open, setOpen] = useState(true)
  const [provider, setProvider] = useState<AIProvider>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [cefrAnnotation, setCefrAnnotation] = useState(false)

  const providerDef = PROVIDERS.find(p => p.value === provider)!

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const cfg: TranslationConfig = JSON.parse(saved)
        setProvider(cfg.provider)
        setApiKey(cfg.apiKey)
        setModel(cfg.model || '')
        setCefrAnnotation(cfg.cefrAnnotation ?? false)
        onConfigChange(cfg)
        setOpen(false)
      }
    } catch {
      /* ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = () => {
    if (!apiKey.trim()) return
    const cfg: TranslationConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: model || undefined,
      cefrAnnotation: cefrAnnotation || undefined,
    }
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    onConfigChange(cfg)
    setOpen(false)
  }

  const handleClear = () => {
    localStorage.removeItem(LS_KEY)
    setApiKey('')
    setModel('')
    setCefrAnnotation(false)
    onConfigChange(null)
    setOpen(true)
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">⚙️</span>
          <span className="font-semibold text-white">Cài đặt API</span>
          {!open && apiKey && (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              {providerDef.label} · đã kết nối
            </span>
          )}
          {!open && cefrAnnotation && (
            <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
              CEFR bật
            </span>
          )}
        </div>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-700 pt-4">
          {/* Provider */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <div className="flex gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setProvider(p.value); setModel('') }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    provider === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              API Key <span className="text-gray-500">(lưu local, không gửi server)</span>
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={providerDef.placeholder}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="px-3 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 text-sm"
              >
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Model <span className="text-gray-500">(tùy chọn)</span>
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Mặc định ({providerDef.models[0]})</option>
              {providerDef.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* CEFR Annotation */}
          <div className="border-t border-gray-700 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setCefrAnnotation(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${cefrAnnotation ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cefrAnnotation ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Đánh dấu từ vựng CEFR{' '}
                <span className="inline-flex gap-1 text-xs">
                  <span className="text-blue-400 font-bold">B1</span>
                  <span className="text-green-400 font-bold">B2</span>
                  <span className="text-amber-400 font-bold">C1</span>
                  <span className="text-red-400 font-bold">C2</span>
                </span>
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1.5 ml-13 pl-1">
              Đánh dấu màu từ vựng tiếng Anh &amp; tiếng Việt theo trình độ CEFR trong file xuất. Dịch chậm hơn một chút.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Lưu cài đặt
            </button>
            {apiKey && (
              <button
                onClick={handleClear}
                className="px-5 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
