'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { DocumentBlock } from '@/lib/types'

interface Props {
  onFileParsed: (blocks: DocumentBlock[], fileName: string, fileType: 'pdf' | 'epub') => void
}

const MAX_MB = 50

export default function FileUpload({ onFileParsed }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError('')
    setInfo('')

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File quá lớn. Tối đa ${MAX_MB}MB.`)
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'epub') {
      setError('Chỉ hỗ trợ file .pdf và .epub')
      return
    }

    setLoading(true)
    setInfo(`Đang phân tích ${file.name}...`)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Lỗi phân tích file')
        return
      }

      const { blocks, pageCount, fileType } = data
      setInfo(`Phân tích xong: ${pageCount} trang · ${blocks.length} đoạn văn`)
      onFileParsed(blocks, file.name, fileType)
    } catch (err) {
      setError(`Lỗi kết nối: ${err instanceof Error ? err.message : err}`)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center rounded-[18px] border-2 border-dashed p-14 cursor-pointer transition-all duration-300 select-none active-scale overflow-hidden group
        ${dragging ? 'border-transparent bg-white/20 dark:bg-black/40 scale-[1.01]' : 'border-white/20 hover:border-white/35'}
        ${loading ? 'cursor-wait pointer-events-none' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 40%, #0d9488 100%)',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '18px'
      }}
    >
      {/* Siri/Apple Intelligence glowing border overlay when dragging files */}
      {dragging && (
        <div className="absolute inset-0 bg-iphone-neon p-[2px] -z-10 rounded-[18px] animate-pulse opacity-90" />
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub"
        className="hidden"
        onChange={onChange}
      />

      <div className={`mb-5 transition-transform duration-500 ${loading ? 'animate-spin scale-90' : 'group-hover:scale-105'}`}>
        {loading ? (
          <div className="text-5xl select-none">🌀</div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center space-y-2">
          <p className="!text-yellow-300 font-bold text-[18px]">Đang tải lên tài liệu...</p>
          <p className="!text-yellow-200 text-sm font-light tracking-wide">{info}</p>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <p className="!text-yellow-300 font-bold text-[18px]">Kéo &amp; thả sách ngoại văn vào đây</p>
          <p className="!text-yellow-200 text-[18px] font-medium">hoặc nhấn trực tiếp để duyệt file từ máy tính</p>
          <div className="pt-3">
            <span className="inline-block text-xs !text-yellow-300 font-bold uppercase tracking-wide bg-white/10 px-5 py-1.5 rounded-full border border-white/20 shadow-md backdrop-blur-sm">
              ĐỊNH DẠNG HỖ TRỢ: .EPUB hoặc .PDF &nbsp;|&nbsp; TỐI ĐA {MAX_MB}MB
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 px-5 py-2.5 bg-red-500/20 border border-red-500/30 rounded-full !text-yellow-200 text-xs font-bold shadow-md backdrop-blur-sm">
          ⚠️ {error}
        </div>
      )}
      {info && !loading && (
        <div className="mt-5 px-5 py-2.5 bg-green-500/20 border border-green-500/30 rounded-full !text-yellow-200 text-xs font-bold shadow-md backdrop-blur-sm">
          ✅ {info}
        </div>
      )}
    </div>
  )
}
