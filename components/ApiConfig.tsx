'use client'

import { useState, useEffect } from 'react'
import { AIProvider, TranslationConfig } from '@/lib/types'

const PROVIDERS: { value: AIProvider; label: string; models: string[]; placeholder: string; envKey: string }[] = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    placeholder: 'sk-...',
    envKey: 'DEEPSEEK_API_KEY',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    placeholder: 'AIza...',
    envKey: 'GEMINI_API_KEY',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    placeholder: 'sk-...',
    envKey: 'OPENAI_API_KEY',
  },
  {
    value: 'claude',
    label: 'Claude',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
    placeholder: 'sk-ant-...',
    envKey: 'ANTHROPIC_API_KEY',
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
  const [envStatus, setEnvStatus] = useState<'idle' | 'saving' | 'loading' | 'saved' | 'loaded' | 'error'>('idle')
  const [showEnvPanel, setShowEnvPanel] = useState(false)
  const [envKeys, setEnvKeys] = useState<Record<string, string>>({
    DEEPSEEK_API_KEY: '',
    GEMINI_API_KEY: '',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
  })

  // Separate keys for each model and mode
  const [deepseekApiKey, setDeepseekApiKey] = useState('')
  const [geminiFreeApiKey, setGeminiFreeApiKey] = useState('')
  const [geminiPaidApiKey, setGeminiPaidApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')

  const providerDef = PROVIDERS.find(p => p.value === provider)!

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const cfg: TranslationConfig = JSON.parse(saved)
        setProvider(cfg.provider)
        setApiKey(cfg.apiKey)
        setModel(cfg.model || '')
        setCefrAnnotation(cfg.cefrAnnotation ?? false)
        
        // Load and migrate individual keys
        setDeepseekApiKey(cfg.deepseekApiKey || (cfg.provider === 'deepseek' ? cfg.apiKey : ''))
        setGeminiFreeApiKey(cfg.geminiFreeApiKey || (cfg.provider === 'gemini' && !cfg.geminiPaidApiKey ? cfg.apiKey : ''))
        setGeminiPaidApiKey(cfg.geminiPaidApiKey || '')
        setOpenaiApiKey(cfg.openaiApiKey || (cfg.provider === 'openai' ? cfg.apiKey : ''))
        setClaudeApiKey(cfg.claudeApiKey || (cfg.provider === 'claude' ? cfg.apiKey : ''))
        
        onConfigChange(cfg)
        setOpen(false)
      }
    } catch {
      /* ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = () => {
    const activeApiKey = 
      provider === 'deepseek' ? deepseekApiKey :
      provider === 'gemini' ? geminiFreeApiKey || geminiPaidApiKey :
      provider === 'openai' ? openaiApiKey :
      provider === 'claude' ? claudeApiKey : ''

    if (!activeApiKey.trim()) return

    const cfg: TranslationConfig = {
      provider,
      apiKey: activeApiKey.trim(),
      model: model || undefined,
      cefrAnnotation: cefrAnnotation || undefined,
      deepseekApiKey: deepseekApiKey.trim() || undefined,
      geminiFreeApiKey: geminiFreeApiKey.trim() || undefined,
      geminiPaidApiKey: geminiPaidApiKey.trim() || undefined,
      openaiApiKey: openaiApiKey.trim() || undefined,
      claudeApiKey: claudeApiKey.trim() || undefined,
    }
    
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    setApiKey(activeApiKey.trim())
    onConfigChange(cfg)
    setOpen(false)
  }

  const handleClear = () => {
    localStorage.removeItem(LS_KEY)
    setApiKey('')
    setDeepseekApiKey('')
    setGeminiFreeApiKey('')
    setGeminiPaidApiKey('')
    setOpenaiApiKey('')
    setClaudeApiKey('')
    setModel('')
    setCefrAnnotation(false)
    onConfigChange(null)
    setOpen(true)
  }

  // Load all env keys from .env.local
  const loadEnvKeys = async () => {
    setEnvStatus('loading')
    try {
      const res = await fetch('/api/env-keys')
      const data = await res.json() as Record<string, string>
      setEnvKeys(data)
      // Auto-fill current provider's key if available
      const currentEnvKey = providerDef.envKey
      if (data[currentEnvKey]) {
        setApiKey(data[currentEnvKey])
      }
      setEnvStatus('loaded')
      setTimeout(() => setEnvStatus('idle'), 2000)
    } catch {
      setEnvStatus('error')
      setTimeout(() => setEnvStatus('idle'), 2000)
    }
  }

  // Save current key to .env.local
  const saveToEnv = async () => {
    if (!apiKey.trim()) return
    setEnvStatus('saving')
    try {
      await fetch('/api/env-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [providerDef.envKey]: apiKey.trim() }),
      })
      setEnvStatus('saved')
      setTimeout(() => setEnvStatus('idle'), 2000)
    } catch {
      setEnvStatus('error')
      setTimeout(() => setEnvStatus('idle'), 2000)
    }
  }

  // Save all env keys from panel
  const saveAllEnvKeys = async () => {
    setEnvStatus('saving')
    try {
      await fetch('/api/env-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envKeys),
      })
      setEnvStatus('saved')
      setTimeout(() => setEnvStatus('idle'), 2000)
    } catch {
      setEnvStatus('error')
      setTimeout(() => setEnvStatus('idle'), 2000)
    }
  }

  const envStatusLabel = {
    idle: null,
    saving: '⏳ Đang lưu...',
    loading: '⏳ Đang tải...',
    saved: '✅ Đã lưu vào .env.local',
    loaded: '✅ Đã tải từ .env.local',
    error: '❌ Lỗi thao tác file',
  }[envStatus]

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
            <div className="flex flex-wrap gap-2">
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
          <div className="space-y-3 bg-gray-950/30 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Cấu hình API Key</span>
              <button
                onClick={() => setShowKey(s => !s)}
                className="text-[10px] px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700/50"
              >
                {showKey ? '👁️ Ẩn Keys' : '👁️ Hiện Keys'}
              </button>
            </div>

            {provider === 'gemini' ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                    <span>Gemini Free API Key 🆓</span>
                    <span className="text-[10px] text-gray-500 font-light">Dùng khi không có Paid key</span>
                  </label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiFreeApiKey}
                    onChange={e => setGeminiFreeApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini Free Key)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                    <span>Gemini Paid API Key (Billing) 💳</span>
                    <span className="text-[10px] text-yellow-500/80 font-medium">Tạo cache + dịch với cache (rẻ 75%)</span>
                  </label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiPaidApiKey}
                    onChange={e => setGeminiPaidApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini Paid Key)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2 text-[10px] text-blue-300/80 leading-relaxed">
                  <span className="font-semibold text-blue-300">Luồng Context Caching:</span>{' '}
                  Paid key → Upload nội dung sách lên cache → Dịch toàn bộ sách với cache (tiết kiệm ~75% tokens) → Kết quả rất nhanh và rẻ.
                </div>
              </div>
            ) : provider === 'deepseek' ? (
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">DeepSeek API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={deepseekApiKey}
                  onChange={e => setDeepseekApiKey(e.target.value)}
                  placeholder="sk-... (DeepSeek API Key)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            ) : provider === 'openai' ? (
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">OpenAI API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-... (OpenAI API Key)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Claude API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={e => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-... (Claude API Key)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
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
            <p className="text-xs text-gray-500 mt-1.5 pl-13">
              Đánh dấu màu từ vựng tiếng Anh &amp; tiếng Việt theo trình độ CEFR trong file xuất. Dịch chậm hơn một chút.
            </p>
          </div>

          {/* Env file management */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Quản lý .env.local</span>
              <button
                onClick={() => { setShowEnvPanel(v => !v); if (!showEnvPanel) loadEnvKeys() }}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                {showEnvPanel ? 'Ẩn' : 'Quản lý tất cả key'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadEnvKeys}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-xs font-medium transition-colors"
              >
                ↓ Tải từ .env
              </button>
              <button
                onClick={saveToEnv}
                disabled={!apiKey.trim()}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-xs font-medium transition-colors disabled:opacity-40"
              >
                ↑ Lưu vào .env
              </button>
              {envStatusLabel && (
                <span className={`text-xs self-center ${envStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {envStatusLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              Lưu API key vào file .env.local — tự điền lại mỗi lần mở app.
            </p>

            {/* All-keys panel */}
            {showEnvPanel && (
              <div className="mt-3 bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700">
                <p className="text-xs text-gray-400 font-medium mb-2">Tất cả API key trong .env.local:</p>
                {PROVIDERS.map(p => (
                  <div key={p.value} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{p.label}:</span>
                    <input
                      type="password"
                      value={envKeys[p.envKey] || ''}
                      onChange={e => setEnvKeys(prev => ({ ...prev, [p.envKey]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
                <button
                  onClick={saveAllEnvKeys}
                  className="w-full mt-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors"
                >
                  Lưu tất cả vào .env.local
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={
                provider === 'deepseek' ? !deepseekApiKey.trim() :
                provider === 'gemini' ? (!geminiFreeApiKey.trim() && !geminiPaidApiKey.trim()) :
                provider === 'openai' ? !openaiApiKey.trim() :
                !claudeApiKey.trim()
              }
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Lưu cài đặt
            </button>
            {(apiKey || deepseekApiKey || geminiFreeApiKey || geminiPaidApiKey || openaiApiKey || claudeApiKey) && (
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
