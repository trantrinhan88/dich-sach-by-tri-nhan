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
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all
        ${dragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 bg-gray-900 hover:border-gray-500 hover:bg-gray-800/50'}
        ${loading ? 'cursor-wait pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub"
        className="hidden"
        onChange={onChange}
      />

      <div className="text-5xl mb-4">{loading ? '⏳' : '📄'}</div>

      {loading ? (
        <div className="text-center">
          <p className="text-white font-medium">Đang xử lý...</p>
          <p className="text-gray-400 text-sm mt-1">{info}</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-white font-medium text-lg">Kéo thả file vào đây</p>
          <p className="text-gray-400 mt-1">hoặc nhấn để chọn file</p>
          <p className="text-gray-500 text-sm mt-3">Hỗ trợ: .epub · .pdf &nbsp;|&nbsp; Tối đa {MAX_MB}MB</p>
        </div>
      )}

      {error && (
        <div className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {info && !loading && (
        <div className="mt-4 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg text-green-300 text-sm">
          {info}
        </div>
      )}
    </div>
  )
}
