'use client'

import { useState, useRef } from 'react'
import ApiConfig from '@/components/ApiConfig'
import FileUpload from '@/components/FileUpload'
import TranslationProgress from '@/components/TranslationProgress'
import DocumentPreview from '@/components/DocumentPreview'
import { DocumentBlock, ExportFormat, TranslationConfig } from '@/lib/types'

type Step = 'upload' | 'ready' | 'translating' | 'paused' | 'done'

function splitEnglishSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map(s => s.trim())
    .filter(Boolean)
}

function expandForBilingual(blocks: DocumentBlock[]): DocumentBlock[] {
  const result: DocumentBlock[] = []
  let seq = 0
  for (const block of blocks) {
    if (block.type !== 'paragraph') { result.push(block); continue }
    const sentences = splitEnglishSentences(block.originalText)
    if (sentences.length <= 1) { result.push(block); continue }
    for (let i = 0; i < sentences.length; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { translatedText: _t, cefrAnnotatedOriginal: _co, cefrAnnotatedTranslation: _ct, ...rest } = block
      result.push({ ...rest, id: `${block.id}-${seq++}`, originalText: sentences[i] })
    }
  }
  return result
}

export default function Home() {
  const [apiConfig, setApiConfig] = useState<TranslationConfig | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [blocks, setBlocks] = useState<DocumentBlock[]>([])
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<'pdf' | 'epub'>('pdf')
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [partialTranslated, setPartialTranslated] = useState<DocumentBlock[]>([])
  const [exportFormat, setExportFormat] = useState<ExportFormat>('epub')
  const [error, setError] = useState('')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [bilingual, setBilingual] = useState(false)
  const [isCaching, setIsCaching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const cacheNameRef = useRef<string | null>(null)

  const handleFileParsed = (parsedBlocks: DocumentBlock[], name: string, type: 'pdf' | 'epub') => {
    setBlocks(parsedBlocks)
    setFileName(name)
    setFileType(type)
    setStep('ready')
    setPartialTranslated([])
    setError('')
  }

  const runTranslation = async (
    workingBlocks: DocumentBlock[],
    signal: AbortSignal,
    onComplete: (blocks: DocumentBlock[]) => void
  ) => {
    const configWithCache = cacheNameRef.current
      ? { ...apiConfig, cacheName: cacheNameRef.current }
      : apiConfig

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: workingBlocks, config: configWithCache }),
      signal,
    })

    if (!res.body) throw new Error('Không nhận được dữ liệu từ server')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      const parts = buf.split('\n\n')
      buf = parts.pop() || ''

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        const data = JSON.parse(part.slice(6))

        if (data.type === 'progress') {
          setProgress({ completed: data.completed, total: data.total })
          if (data.newlyTranslated?.length) {
            setPartialTranslated(prev => {
              const map = new Map(prev.map(b => [b.id, b]))
              for (const t of data.newlyTranslated) {
                const block = map.get(t.id)
                if (block) {
                  map.set(t.id, {
                    ...block,
                    translatedText: t.translatedText,
                    ...(t.cefrAnnotatedOriginal && { cefrAnnotatedOriginal: t.cefrAnnotatedOriginal }),
                    ...(t.cefrAnnotatedTranslation && { cefrAnnotatedTranslation: t.cefrAnnotatedTranslation }),
                  })
                }
              }
              return prev.map(b => map.get(b.id) ?? b)
            })
          }
        } else if (data.type === 'complete') {
          onComplete(data.blocks)
          setStep('done')
        } else if (data.type === 'error') {
          throw new Error(data.message)
        }
      }
    }

    // reader.read() có thể trả về done:true thay vì throw khi fetch bị abort —
    // kiểm tra signal để đảm bảo chuyển đúng sang 'paused'
    if (signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
    }
  }

  const handleTranslate = async () => {
    if (!apiConfig) { setError('Vui lòng cài đặt API key trước.'); return }
    if (!blocks.length) return

    setError('')

    // Tự động tạo bộ đệm (Context Cache) cho Gemini để tối ưu hóa chi phí
    if (apiConfig.provider === 'gemini') {
      setIsCaching(true)
      try {
        const cacheRes = await fetch('/api/translate/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, config: apiConfig }),
        })
        if (!cacheRes.ok) {
          const errData = await cacheRes.json()
          throw new Error(errData.error || 'Khởi tạo bộ nhớ đệm Context Cache thất bại')
        }
        const cacheData = await cacheRes.json()
        if (cacheData.cacheNotSupported) {
          cacheNameRef.current = null
          setWarningMessage(cacheData.warning)
        } else {
          cacheNameRef.current = cacheData.cacheName
          setWarningMessage(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi tạo bộ đệm Context Caching')
        setIsCaching(false)
        return
      }
      setIsCaching(false)
    } else {
      cacheNameRef.current = null
      setWarningMessage(null)
    }

    setStep('translating')

    const workingBlocks = bilingual ? expandForBilingual(blocks) : blocks
    const initBlocks = workingBlocks.map(b => ({ ...b, translatedText: undefined as string | undefined }))
    setPartialTranslated(initBlocks)
    setProgress({
      completed: 0,
      total: workingBlocks.filter(b => b.type !== 'code' && b.type !== 'image').length,
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await runTranslation(workingBlocks, controller.signal, (translated) => {
        setPartialTranslated(translated)
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStep('paused')
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định')
        setStep('ready')
      }
    } finally {
      abortRef.current = null
    }
  }

  const handlePause = () => {
    abortRef.current?.abort()
  }

  const handleResume = async () => {
    if (!apiConfig) { setError('Vui lòng cài đặt API key trước.'); return }

    const remaining = partialTranslated.filter(b =>
      b.type !== 'code' &&
      b.type !== 'image' &&
      (!b.translatedText || b.translatedText.startsWith('[CHƯA DỊCH]'))
    )

    if (!remaining.length) {
      setStep('done')
      return
    }

    setError('')

    // Tái thiết lập Cache nếu bị mất hoặc hết hạn
    if (apiConfig.provider === 'gemini' && !cacheNameRef.current) {
      setIsCaching(true)
      try {
        const cacheRes = await fetch('/api/translate/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, config: apiConfig }),
        })
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json()
          if (cacheData.cacheNotSupported) {
            cacheNameRef.current = null
            setWarningMessage(cacheData.warning)
          } else {
            cacheNameRef.current = cacheData.cacheName
            setWarningMessage(null)
          }
        }
      } catch (err) {
        console.error('Lỗi tái tạo cache:', err)
      }
      setIsCaching(false)
    }

    setStep('translating')
    setProgress({ completed: 0, total: remaining.length })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await runTranslation(remaining, controller.signal, (translated) => {
        setPartialTranslated(prev =>
          prev.map(b => {
            const updated = translated.find(t => t.id === b.id)
            if (!updated?.translatedText) return b
            return {
              ...b,
              translatedText: updated.translatedText,
              ...(updated.cefrAnnotatedOriginal && { cefrAnnotatedOriginal: updated.cefrAnnotatedOriginal }),
              ...(updated.cefrAnnotatedTranslation && { cefrAnnotatedTranslation: updated.cefrAnnotatedTranslation }),
            }
          })
        )
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStep('paused')
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định')
        setStep('paused')
      }
    } finally {
      abortRef.current = null
    }
  }

  const handleExport = async (sourceBlocks = partialTranslated) => {
    setExporting(true)
    setError('')
    try {
      const exportBlocks = sourceBlocks.map(b => ({
        ...b,
        translatedText: b.translatedText?.startsWith('[CHƯA DỊCH]')
          ? b.originalText
          : (b.translatedText || b.originalText),
      }))

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: exportBlocks,
          format: exportFormat,
          title: fileName.replace(/\.(pdf|epub)$/i, '') + (bilingual ? ' (Song ngữ)' : ' (Tiếng Việt)'),
          bilingual,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Xuất file thất bại')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName.replace(/\.(pdf|epub)$/i, '')}_${bilingual ? 'bilingual' : 'vi'}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xuất file')
    } finally {
      setExporting(false)
    }
  }

  const resetToUpload = () => {
    abortRef.current?.abort()
    setStep('upload')
    setBlocks([])
    setPartialTranslated([])
    setFileName('')
    setError('')
    cacheNameRef.current = null
  }

  const translatedCount = partialTranslated.filter(
    b => b.translatedText && !b.translatedText.startsWith('[CHƯA DỊCH]')
  ).length
  const totalCount = partialTranslated.filter(b => b.type !== 'code' && b.type !== 'image').length

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-gray-950 to-zinc-950 relative overflow-hidden">
      {/* Dynamic ambient highlights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 py-10 relative z-10 space-y-8">
        {/* Header */}
        <header className="text-center md:text-left border-b border-white/5 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-blue-300 font-medium mb-3 backdrop-blur-md">
            ⚡ Tối ưu dịch thuật song ngữ với Gemini 2.5 Flash
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight">
            📖 DỊCH SÁCH SONG NGỮ
          </h1>
          <p className="text-gray-400 mt-2 text-base max-w-2xl font-light leading-relaxed">
            Học ngoại ngữ qua dịch sách định dạng EPUB thành từng câu song ngữ. Tự động hóa bộ đệm <span className="text-blue-400 font-medium">Context Caching</span> giúp tiết kiệm 90% chi phí API.
          </p>
          <p className="text-gray-500 mt-1.5 text-xs">
            Tác giả: Trần Trí Nhân
          </p>
        </header>

        {/* API Config */}
        <ApiConfig onConfigChange={setApiConfig} />

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-xl px-5 py-3 text-red-300 text-sm flex items-start gap-3 backdrop-blur-md">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-200 font-bold">✕</button>
          </div>
        )}

        {/* Warning banner */}
        {warningMessage && (
          <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-xl px-5 py-3 text-yellow-300 text-sm flex items-start gap-3 backdrop-blur-md">
            <span>💡</span>
            <span>{warningMessage}</span>
            <button onClick={() => setWarningMessage(null)} className="ml-auto text-yellow-400 hover:text-yellow-200 font-bold font-mono">✕</button>
          </div>
        )}

        {/* Caching Shimmer Loader */}
        {isCaching && (
          <div className="bg-white/5 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl shadow-blue-500/10">
            <div className="relative inline-flex">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 text-3xl animate-spin">
                🌀
              </span>
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-[9px] font-bold text-white shadow-md">
                AI
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 tracking-wide">
                🔮 ĐANG TỐI ƯU CHI PHÍ VỚI CONTEXT CACHING...
              </h3>
              <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                Đang đẩy nội dung sách gốc lên bộ đệm đám mây của Google AI Studio. 
                Quá trình này chỉ diễn ra một lần và giúp giảm 90% chi phí API, đồng thời giúp AI ghi nhớ toàn bộ văn cảnh.
              </p>
            </div>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && !isCaching && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Bước 1: Tải lên tài liệu (.epub)
            </h2>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-1 shadow-xl">
              <FileUpload onFileParsed={handleFileParsed} />
            </div>
          </section>
        )}

        {/* Step: Ready to translate */}
        {step === 'ready' && (
          <section className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">📄 {fileName}</p>
                <p className="text-gray-400 text-sm mt-0.5">{blocks.length} đoạn văn · {fileType.toUpperCase()}</p>
              </div>
              <button onClick={resetToUpload} className="text-gray-400 hover:text-white text-sm px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                Đổi file
              </button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={handleTranslate}
                disabled={!apiConfig}
                className="px-7 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20"
              >
                ▶ Bắt đầu dịch
              </button>

              <button
                onClick={() => setBilingual(b => !b)}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                  bilingual
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {bilingual ? '🔤 Song ngữ Bật' : '🔤 Song ngữ'}
              </button>

              {bilingual && (
                <span className="text-purple-300 text-sm">
                  Mỗi đoạn 1 câu · xuất kèm bản gốc tiếng Anh
                </span>
              )}

              {!apiConfig && (
                <span className="text-yellow-400 text-sm">← Cần cài đặt API key trước</span>
              )}
            </div>
          </section>
        )}

        {/* Step: Translating */}
        {step === 'translating' && (
          <section className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-white font-medium truncate">📄 {fileName}</p>
                <p className="text-gray-400 text-sm">
                  {blocks.length} đoạn văn{bilingual ? ' · chế độ song ngữ' : ''}
                </p>
              </div>
            </div>
            <TranslationProgress
              completed={progress.completed}
              total={progress.total}
              onPause={handlePause}
            />
          </section>
        )}

        {/* Step: Paused */}
        {step === 'paused' && (
          <section className="space-y-4">
            {/* Status card */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-yellow-300 font-semibold">⏸ Đã tạm dừng · {fileName}</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Đã dịch {translatedCount} / {totalCount} đoạn
                    {totalCount > 0 && (
                      <span className="ml-2 text-yellow-500/70">
                        ({Math.round((translatedCount / totalCount) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResume}
                    disabled={!apiConfig}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    ▶ Dịch tiếp
                  </button>
                  <button
                    onClick={resetToUpload}
                    className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 text-sm transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Export partial results */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-gray-300 text-sm font-medium mb-3">
                📦 Xuất file {translatedCount > 0 ? `(${translatedCount} đoạn đã dịch)` : ''}
              </p>
              {translatedCount === 0 ? (
                <p className="text-yellow-400/80 text-sm">
                  Chưa có đoạn nào hoàn thành. Bấm <span className="font-semibold">▶ Dịch tiếp</span> để dịch thêm rồi tạm dừng lại để xuất.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {(['epub', 'html', 'docx', 'pdf'] as ExportFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        exportFormat === fmt
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                  <button
                    onClick={() => handleExport()}
                    disabled={exporting}
                    className="px-5 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
                  >
                    {exporting ? '⏳ Đang tạo...' : '⬇ Tải về'}
                  </button>
                  {exportFormat === 'pdf' && (
                    <p className="text-yellow-300/70 text-xs mt-2 w-full">
                      💡 Các đoạn chưa dịch sẽ hiển thị bản gốc tiếng Anh.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step: Done — preview + export */}
        {step === 'done' && partialTranslated.length > 0 && (
          <section className="space-y-5">
            {/* Export bar */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  ✅ Dịch xong: {fileName}
                  {bilingual && <span className="ml-2 text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">Song ngữ</span>}
                </p>
              </div>

              <span className="text-gray-400 text-sm">Xuất ra:</span>
              {(['html', 'epub', 'docx', 'pdf'] as ExportFormat[]).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    exportFormat === fmt
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}

              <button
                onClick={() => handleExport()}
                disabled={exporting}
                className="px-5 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
              >
                {exporting ? '⏳ Đang tạo...' : '⬇ Tải về'}
              </button>

              <button
                onClick={resetToUpload}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 text-sm transition-colors"
              >
                File mới
              </button>
            </div>

            {exportFormat === 'pdf' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-300 text-sm">
                💡 Lần đầu xuất PDF sẽ tự tải font tiếng Việt (~1.5MB). Hoặc dùng HTML rồi in bằng trình duyệt để có chất lượng cao hơn.
              </div>
            )}

            {/* Preview */}
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Xem trước bản dịch{bilingual ? ' (song ngữ)' : ''}
            </h2>
            <DocumentPreview blocks={partialTranslated} bilingual={bilingual} />
          </section>
        )}
      </div>
    </main>
  )
}
