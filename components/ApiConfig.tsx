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
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<AIProvider>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [cefrAnnotation, setCefrAnnotation] = useState(false)
  const [envStatus, setEnvStatus] = useState<'idle' | 'saving' | 'loading' | 'saved' | 'loaded' | 'error'>('idle')
  const [showEnvPanel, setShowEnvPanel] = useState(false)
  const [concurrency, setConcurrency] = useState<number | ''>('')
  const [chunkSize, setChunkSize] = useState<number | ''>('')
  const [showAdvanced, setShowAdvanced] = useState(false)
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
        setConcurrency(cfg.concurrency ?? '')
        setChunkSize(cfg.chunkSize ?? '')
        
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
      concurrency: concurrency ? Number(concurrency) : undefined,
      chunkSize: chunkSize ? Number(chunkSize) : undefined,
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
    setConcurrency('')
    setChunkSize('')
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

  const getDefaultSpeedHint = () => {
    if (provider === 'gemini') {
      const isPaid = !!geminiPaidApiKey.trim()
      return { threads: isPaid ? 5 : 1, size: 120, note: isPaid ? 'Gemini Paid' : 'Gemini Free' }
    }
    if (provider === 'deepseek') {
      const isReasoner = model === 'deepseek-v4-pro' || model === 'deepseek-reasoner'
      return { threads: isReasoner ? 1 : 4, size: isReasoner ? 10 : 30, note: isReasoner ? 'DeepSeek Reasoner (R1)' : 'DeepSeek Chat (V3)' }
    }
    if (provider === 'openai') {
      return { threads: 5, size: 25, note: 'OpenAI' }
    }
    if (provider === 'claude') {
      return { threads: 3, size: 25, note: 'Claude' }
    }
    return { threads: 2, size: 25, note: '' }
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
    <div
      className="custom-gradient-card border border-white/10 rounded-[18px] shadow-lg overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 40%, #0d9488 100%)',
        color: '#facc15',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '18px'
      }}
    >
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors select-none active-scale"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <span className="font-extrabold !text-yellow-300 text-[20px]">Cài đặt API</span>
          {!open && apiKey && (
            <span className="text-[12px] uppercase font-mono tracking-wider bg-green-500/20 !text-green-200 px-3 py-1 rounded-full border border-green-500/20 font-bold">
              {providerDef.label} · đã kết nối
            </span>
          )}
          {!open && cefrAnnotation && (
            <span className="text-[12px] uppercase font-mono tracking-wider bg-white/10 !text-yellow-300 px-3 py-1 rounded-full border border-yellow-300/20 font-bold">
              CEFR bật
            </span>
          )}
        </div>
        <span className="!text-yellow-300/80 text-sm font-bold">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-5">
          {/* Provider Option Chips */}
          <div>
            <label className="block text-[15px] font-extrabold !text-yellow-300 uppercase tracking-wider mb-3">AI Provider</label>
            <div className="flex flex-wrap gap-3">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setProvider(p.value); setModel('') }}
                  className={`px-6 py-2.5 rounded-full text-[15px] font-extrabold transition-all active-scale shadow-md ${
                    provider === p.value
                      ? 'bg-yellow-300 !text-black shadow-lg border-2 border-yellow-300 scale-[1.03]'
                      : 'bg-white/10 !text-yellow-300 hover:bg-white/20 border-2 border-yellow-300/25'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Panel (Configurator Style) */}
          <div className="space-y-4 bg-black/20 p-5 rounded-[18px] border border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-[15px] font-extrabold !text-yellow-300 uppercase tracking-wider">Cấu hình API Key</span>
              <button
                onClick={() => setShowKey(s => !s)}
                className="text-[13px] px-4 py-2 bg-white/10 hover:bg-white/20 !text-yellow-300 rounded-full transition-colors border-2 border-yellow-300/20 font-extrabold active-scale"
              >
                {showKey ? '👁️ Ẩn Keys' : '👁️ Hiện Keys'}
              </button>
            </div>

            {provider === 'gemini' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[14px] !text-yellow-200 mb-2 flex items-center justify-between font-bold">
                    <span className="font-extrabold text-[15px]">Gemini Free API Key 🆓</span>
                    <span className="text-[12px] !text-yellow-300/80 font-bold italic">Dùng khi không có Paid key</span>
                  </label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiFreeApiKey}
                    onChange={e => setGeminiFreeApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini Free Key)"
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[15px] placeholder-yellow-300/40 focus:outline-none focus:border-yellow-300 font-mono shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[14px] !text-yellow-200 mb-2 flex items-center justify-between font-bold">
                    <span className="font-extrabold text-[15px]">Gemini Paid API Key (Billing) 💳</span>
                    <span className="text-[12px] !text-pink-300 font-extrabold">Dịch với Context Cache (rẻ 75%)</span>
                  </label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiPaidApiKey}
                    onChange={e => setGeminiPaidApiKey(e.target.value)}
                    placeholder="AIzaSy... (Gemini Paid Key)"
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[15px] placeholder-yellow-300/40 focus:outline-none focus:border-yellow-300 font-mono shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                  />
                </div>
                <div className="bg-black/20 border border-white/10 rounded-xl px-5 py-4 text-[14px] !text-yellow-200 leading-relaxed font-medium">
                  <span className="font-extrabold !text-yellow-300 text-[15px]">Luồng Context Caching hoạt động:</span>{' '}
                  Paid key → Tạo bộ đệm Context Cache cho sách → AI ghi nhớ toàn văn ngữ cảnh → Giảm 75% chi phí dịch thuật mà lại tăng tốc cực nhanh.
                </div>
              </div>
            ) : provider === 'deepseek' ? (
              <div>
                <label className="block text-[14px] !text-yellow-200 mb-2 font-extrabold">DeepSeek API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={deepseekApiKey}
                  onChange={e => setDeepseekApiKey(e.target.value)}
                  placeholder="sk-... (DeepSeek API Key)"
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[15px] placeholder-yellow-300/40 focus:outline-none focus:border-yellow-300 font-mono shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                />
              </div>
            ) : provider === 'openai' ? (
              <div>
                <label className="block text-[14px] !text-yellow-200 mb-2 font-extrabold">OpenAI API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-... (OpenAI API Key)"
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[15px] placeholder-yellow-300/40 focus:outline-none focus:border-yellow-300 font-mono shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[14px] !text-yellow-200 mb-2 font-extrabold">Claude API Key</label>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={e => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-... (Claude API Key)"
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[15px] placeholder-yellow-300/40 focus:outline-none focus:border-yellow-300 font-mono shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                />
              </div>
            )}
          </div>

          {/* Model Selector */}
          <div>
            <label className="block text-[15px] font-extrabold !text-yellow-300 uppercase tracking-wider mb-2">
              Model <span className="!text-yellow-200/80">(tùy chọn)</span>
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-3 !text-yellow-300 text-[16px] focus:outline-none focus:border-yellow-300 font-bold cursor-pointer shadow-sm active-scale transition-all"
            >
              <option value="" className="bg-slate-900 !text-yellow-300 font-bold">Mặc định ({providerDef.models[0]})</option>
              {providerDef.models.map(m => (
                <option key={m} value={m} className="bg-slate-900 !text-yellow-300 font-bold">{m}</option>
              ))}
            </select>
          </div>

          {/* CEFR Vocabulary annotation toggle switcher */}
          <div className="border-t border-white/15 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <div
                onClick={() => setCefrAnnotation(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${cefrAnnotation ? 'bg-yellow-300' : 'bg-white/20'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform ${cefrAnnotation ? 'translate-x-6 bg-blue-600' : 'translate-x-0.5 bg-white'}`} />
              </div>
              <span className="text-[16px] font-extrabold !text-yellow-300 group-hover:!text-yellow-200 transition-colors">
                Đánh dấu cấp độ từ vựng CEFR{' '}
                <span className="inline-flex gap-1.5 text-[12px] font-extrabold ml-1.5">
                  <span className="text-blue-300 font-black">B1</span>
                  <span className="text-green-300 font-black">B2</span>
                  <span className="text-amber-300 font-black">C1</span>
                  <span className="text-red-300 font-black">C2</span>
                </span>
              </span>
            </label>
            <p className="text-[14px] !text-yellow-200 mt-2 pl-14 font-medium leading-relaxed">
              Tự động bôi màu các từ vựng tiếng Anh và tiếng Việt theo thang tiêu chuẩn CEFR để học nhanh.
            </p>
          </div>

          {/* Advanced Concurrency Settings (Speed tuning) */}
          <div className="border-t border-white/15 pt-4">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              type="button"
              className="flex items-center justify-between w-full text-[16px] font-extrabold !text-yellow-300 hover:!text-yellow-200 uppercase tracking-wider select-none active-scale py-2.5"
            >
              <span>⚙️ Tốc độ và gói câu dịch (Nâng cao)</span>
              <span className="!text-yellow-300/80 text-sm font-bold">{showAdvanced ? 'Ẩn ▲' : 'Hiện ▼'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 bg-black/20 p-5 rounded-[18px] border border-white/10 space-y-5">
                <p className="text-[14px] !text-yellow-200 leading-relaxed font-medium">
                  Thiết lập số luồng chạy song song và kích thước gói câu gửi lên AI. Tăng các trị số này giúp dịch nhanh hơn đáng kể, nhưng có thể bị lỗi giới hạn (Rate Limit / 429) nếu tài khoản của bạn chưa nạp tiền hoặc bị giới hạn API.
                </p>

                <div className="bg-white/10 p-4 rounded-xl text-[14px] !text-yellow-300 border border-white/10 flex justify-between font-bold">
                  <span>Mặc định hệ thống đề xuất:</span>
                  <span className="font-extrabold !text-yellow-300">
                    {getDefaultSpeedHint().threads} luồng · {getDefaultSpeedHint().size} câu ({getDefaultSpeedHint().note})
                  </span>
                </div>

                {/* Concurrency Range */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[15px] font-bold">
                    <label className="!text-yellow-200 font-extrabold">Số luồng dịch song song (Concurrency)</label>
                    <span className="!text-yellow-300 font-mono font-black text-[16px]">
                      {concurrency === '' ? `${getDefaultSpeedHint().threads} (Mặc định)` : `${concurrency} luồng`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={concurrency === '' ? getDefaultSpeedHint().threads : concurrency}
                    onChange={e => setConcurrency(Number(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-yellow-400"
                  />
                  <div className="flex justify-between text-[12px] !text-yellow-300/80 px-0.5 font-mono font-bold">
                    <span>1 luồng (Ổn định)</span>
                    <span>5 luồng</span>
                    <span>10 luồng (Tốc lực)</span>
                  </div>
                  {Number(concurrency || getDefaultSpeedHint().threads) > 5 && (
                    <p className="text-[13px] !text-pink-300 font-extrabold leading-relaxed">
                      ⚠️ Cảnh báo: Tăng &gt; 5 luồng dịch có thể gây lỗi giới hạn băng thông (Rate Limit) đối với các tài khoản miễn phí.
                    </p>
                  )}
                </div>

                {/* Chunk Size Range */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[15px] font-bold">
                    <label className="!text-yellow-200 font-extrabold">Số câu trong một gói dịch (Chunk Size)</label>
                    <span className="!text-yellow-300 font-mono font-black text-[16px]">
                      {chunkSize === '' ? `${getDefaultSpeedHint().size} (Mặc định)` : `${chunkSize} câu / gói`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={chunkSize === '' ? getDefaultSpeedHint().size : chunkSize}
                    onChange={e => setChunkSize(Number(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-yellow-400"
                  />
                  <div className="flex justify-between text-[12px] !text-yellow-300/80 px-0.5 font-mono font-bold">
                    <span>5 câu (Ngữ cảnh ngắn)</span>
                    <span>40 câu</span>
                    <span>120 câu (Ngữ cảnh rộng)</span>
                  </div>
                  {Number(chunkSize || getDefaultSpeedHint().size) > 60 && provider === 'deepseek' && (
                    <p className="text-[13px] !text-pink-300 font-extrabold leading-relaxed">
                      ⚠️ Cảnh báo: DeepSeek hoạt động tốt nhất ở các gói nhỏ (&lt;= 40 câu) để đảm bảo độ chính xác ngữ pháp dịch thuật.
                    </p>
                  )}
                </div>

                {/* Action button to reset */}
                {(concurrency !== '' || chunkSize !== '') && (
                  <button
                    onClick={() => { setConcurrency(''); setChunkSize('') }}
                    type="button"
                    className="text-[13px] !text-yellow-300/80 hover:!text-yellow-300 underline transition-colors font-extrabold"
                  >
                    Khôi phục thiết lập đề xuất
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Env File local settings */}
          <div className="border-t border-white/15 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[16px] font-extrabold !text-yellow-300 uppercase tracking-wider">Tệp môi trường .env.local</span>
              <button
                onClick={() => { setShowEnvPanel(v => !v); if (!showEnvPanel) loadEnvKeys() }}
                className="text-[14px] !text-yellow-300 hover:underline font-extrabold active-scale"
              >
                {showEnvPanel ? 'Ẩn bảng quản lý' : 'Xem tất cả key'}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadEnvKeys}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 !text-yellow-300 rounded-full border-2 border-yellow-300/20 text-[14px] font-extrabold transition-all active-scale shadow-md"
              >
                ↓ Tải khóa từ file
              </button>
              <button
                onClick={saveToEnv}
                disabled={!apiKey.trim()}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 !text-yellow-300 rounded-full border-2 border-yellow-300/20 text-[14px] font-extrabold transition-all active-scale shadow-md disabled:opacity-40"
              >
                ↑ Lưu khóa vào file
              </button>
              {envStatusLabel && (
                <span className={`text-[14px] self-center font-extrabold ${envStatus === 'error' ? '!text-pink-300' : '!text-green-300'}`}>
                  {envStatusLabel}
                </span>
              )}
            </div>
            <p className="text-[14px] !text-yellow-200 mt-2 font-medium leading-relaxed">
              Lưu trực tiếp khóa API vào tệp cấu hình `.env.local` của dự án để ứng dụng tự động điền trong lần chạy kế tiếp.
            </p>

            {/* All-keys panel */}
            {showEnvPanel && (
              <div className="mt-4 bg-black/20 p-4 rounded-[18px] border border-white/10 space-y-3">
                <p className="text-[15px] !text-yellow-300 font-extrabold uppercase tracking-wider mb-2">Tất cả khóa trong tệp cấu hình:</p>
                {PROVIDERS.map(p => (
                  <div key={p.value} className="flex gap-3 items-center">
                    <span className="text-[14px] !text-yellow-200 w-28 font-extrabold shrink-0">{p.label}:</span>
                    <input
                      type="password"
                      value={envKeys[p.envKey] || ''}
                      onChange={e => setEnvKeys(prev => ({ ...prev, [p.envKey]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 !text-yellow-300 text-[14px] font-mono focus:outline-none focus:border-yellow-300 shadow-sm transition-all focus:ring-2 focus:ring-yellow-300/25 font-bold"
                    />
                  </div>
                ))}
                <button
                  onClick={saveAllEnvKeys}
                  className="w-full mt-3 py-3 bg-yellow-300 hover:bg-yellow-400 !text-gray-900 rounded-full text-[14px] font-extrabold active-scale shadow-lg"
                >
                  Lưu tất cả khóa vào .env.local
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/15">
            <button
              onClick={handleSave}
              disabled={
                provider === 'deepseek' ? !deepseekApiKey.trim() :
                provider === 'gemini' ? (!geminiFreeApiKey.trim() && !geminiPaidApiKey.trim()) :
                provider === 'openai' ? !openaiApiKey.trim() :
                !claudeApiKey.trim()
              }
              className="px-6 py-3 bg-yellow-300 hover:bg-yellow-400 !text-black rounded-full disabled:opacity-40 disabled:cursor-not-allowed text-[15px] font-extrabold shadow-lg active-scale transition-all"
            >
              Lưu cấu hình hoạt động
            </button>
            {(apiKey || deepseekApiKey || geminiFreeApiKey || geminiPaidApiKey || openaiApiKey || claudeApiKey) && (
              <button
                onClick={handleClear}
                className="px-5 py-3 bg-white/10 !text-yellow-300 hover:bg-white/20 border-2 border-yellow-300/20 rounded-full text-[15px] font-extrabold active-scale transition-all"
              >
                Xóa cấu hình
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
