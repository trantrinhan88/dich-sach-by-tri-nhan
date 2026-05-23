'use client'

import { useState, useRef, useEffect } from 'react'
import ApiConfig from '@/components/ApiConfig'
import FileUpload from '@/components/FileUpload'
import TranslationProgress from '@/components/TranslationProgress'
import DocumentPreview from '@/components/DocumentPreview'
import VocabNotebook from '@/components/VocabNotebook'
import { DocumentBlock, ExportFormat, TranslationConfig } from '@/lib/types'
import {
  saveBookToLibrary,
  getLibraryBooks,
  getBookBlocks,
  updateReadingProgress,
  toggleFavorite,
  deleteBookFromLibrary,
  BookMetadata,
} from '@/lib/library'

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

interface ChapterInfo {
  href: string // Unique identifier for the chapter
  title: string
  blocksCount: number
  translatedCount: number
  isCompleted: boolean
  firstBlockIndex: number
}

function getChapters(docBlocks: DocumentBlock[]): ChapterInfo[] {
  const chapters: ChapterInfo[] = []
  let currentChapter: ChapterInfo = {
    href: 'intro',
    title: 'Phần mở đầu / Giới thiệu',
    blocksCount: 0,
    translatedCount: 0,
    isCompleted: false,
    firstBlockIndex: 0,
  }

  let lastHref = ''

  docBlocks.forEach((block, index) => {
    const blockHref = (block.metadata?.chapterHref as string) || 'default_chapter'
    const isNewFile = lastHref !== '' && lastHref !== blockHref
    const isNewHeading = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)

    if (isNewFile || isNewHeading) {
      // Save previous chapter if it had blocks
      if (currentChapter.blocksCount > 0) {
        chapters.push({
          ...currentChapter,
          isCompleted: currentChapter.blocksCount === currentChapter.translatedCount,
        })
      }

      currentChapter = {
        href: block.id, // Dùng ID của block làm định danh chương duy nhất
        title: isNewHeading ? block.originalText : `Chương ${chapters.length + 1}`,
        blocksCount: 0,
        translatedCount: 0,
        isCompleted: false,
        firstBlockIndex: index,
      }
    }

    lastHref = blockHref

    if (block.type !== 'code' && block.type !== 'image') {
      currentChapter.blocksCount += 1
      if (block.translatedText && !block.translatedText.startsWith('[CHƯA DỊCH]')) {
        currentChapter.translatedCount += 1
      }
    }
  })

  if (currentChapter.blocksCount > 0) {
    chapters.push({
      ...currentChapter,
      isCompleted: currentChapter.blocksCount === currentChapter.translatedCount,
    })
  }

  return chapters.filter(c => c.blocksCount > 0)
}

function getBlockChapterMap(docBlocks: DocumentBlock[]): Record<string, string> {
  const map: Record<string, string> = {}
  let currentChapterId = 'intro'
  let lastHref = ''

  docBlocks.forEach((block) => {
    const blockHref = (block.metadata?.chapterHref as string) || 'default_chapter'
    const isNewFile = lastHref !== '' && lastHref !== blockHref
    const isNewHeading = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)

    if (isNewFile || isNewHeading) {
      currentChapterId = block.id
    }

    map[block.id] = currentChapterId
    lastHref = blockHref
  })

  return map
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
  const [activeTab, setActiveTab] = useState<'translate' | 'read' | 'vocab'>('translate')
  const abortRef = useRef<AbortController | null>(null)
  const cacheNameRef = useRef<string | null>(null)

  const [libraryBooks, setLibraryBooks] = useState<BookMetadata[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedBookBlocks, setSelectedBookBlocks] = useState<DocumentBlock[]>([])
  const [selectedBookMetadata, setSelectedBookMetadata] = useState<BookMetadata | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites'>('all')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [translatingBookId, setTranslatingBookId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importInfo, setImportInfo] = useState('')
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])

  useEffect(() => {
    setSelectedChapters([])
  }, [blocks])

  const triggerToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const loadLibrary = async () => {
    try {
      const books = await getLibraryBooks()
      setLibraryBooks(books)
    } catch (err) {
      console.error('Lỗi khi tải thư viện:', err)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadLibrary()
    }
  }, [])

  const handleEpubImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'epub') {
      setError('Chỉ hỗ trợ file .pdf và .epub')
      e.target.value = ''
      return
    }

    setIsImporting(true)
    setImportInfo(`Đang đọc file ${file.name}...`)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setImportInfo(`Đang phân tích cấu trúc sách ${file.name}...`)
      const res = await fetch('/api/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Lỗi phân tích file')
      }

      const { blocks, pageCount, fileType: fType } = data
      setImportInfo(`Đang lưu sách ${file.name} vào thư viện IndexedDB...`)

      const id = `book_${Date.now()}`
      const title = file.name.replace(/\.(pdf|epub)$/i, '')
      const metadata: Omit<BookMetadata, 'createdAt' | 'lastReadAt'> = {
        id,
        title,
        fileType: fType,
        isFavorite: false,
        lastPage: 1,
        totalPages: pageCount || Math.ceil(blocks.length / 20),
        translatedCount: 0,
      }

      await saveBookToLibrary(metadata, blocks)
      triggerToast(`📥 Đã thêm sách "${title}" vào thư viện!`)
      loadLibrary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi nhập file EPUB/PDF')
    } finally {
      setIsImporting(false)
      setImportInfo('')
      e.target.value = ''
    }
  }

  const handleTranslateBookFromLibrary = async (book: BookMetadata) => {
    try {
      const blocks = await getBookBlocks(book.id)
      setTranslatingBookId(book.id)
      setBlocks(blocks)
      setFileName(book.title)
      setFileType(book.fileType)
      setStep('ready')
      setPartialTranslated([])
      setActiveTab('translate')
      triggerToast(`⚡ Đã tải sách "${book.title}" vào phân khu Dịch sách!`)
    } catch (err) {
      console.error('Lỗi khi tải sách để dịch:', err)
      setError('Không thể tải sách để dịch')
    }
  }

  const handleOpenBook = async (book: BookMetadata) => {
    try {
      const blocks = await getBookBlocks(book.id)
      setSelectedBookId(book.id)
      setSelectedBookBlocks(blocks)
      setSelectedBookMetadata(book)
      setFileName(book.title)
      setFileType(book.fileType)
      setBilingual(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải nội dung sách')
    }
  }

  const handleDeleteBook = async (id: string, title: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Bạn có chắc chắn muốn xóa cuốn sách "${title}" khỏi thư viện?`)) {
      try {
        await deleteBookFromLibrary(id)
        triggerToast(`🗑️ Đã xóa "${title}" khỏi thư viện.`)
        loadLibrary()
        
        if (selectedBookId === id) {
          setSelectedBookId(null)
          setSelectedBookBlocks([])
          setSelectedBookMetadata(null)
        }
      } catch (err) {
        console.error('Lỗi khi xóa sách:', err)
      }
    }
  }

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const isFav = await toggleFavorite(id)
      setLibraryBooks(prev =>
        prev.map(b => (b.id === id ? { ...b, isFavorite: isFav } : b))
      )
      triggerToast(isFav ? '❤️ Đã thêm vào danh sách yêu thích' : '💔 Đã xóa khỏi danh sách yêu thích')
    } catch (err) {
      console.error('Lỗi khi thay đổi trạng thái yêu thích:', err)
    }
  }

  const autoSaveToLibrary = async (finalBlocks: DocumentBlock[]) => {
    try {
      const id = translatingBookId || `book_${Date.now()}`
      const title = fileName.replace(/\.(pdf|epub)$/i, '')
      const tCount = finalBlocks.filter(b => b.translatedText && !b.translatedText.startsWith('[CHƯA DỊCH]')).length
      const metadata: Omit<BookMetadata, 'createdAt' | 'lastReadAt'> = {
        id,
        title,
        fileType,
        isFavorite: false,
        lastPage: selectedBookMetadata?.id === id ? selectedBookMetadata.lastPage : 1,
        totalPages: Math.ceil(finalBlocks.length / 20),
        translatedCount: tCount,
      }
      await saveBookToLibrary(metadata, finalBlocks)
      
      // Clear translatingBookId
      setTranslatingBookId(null)
      
      const books = await getLibraryBooks()
      setLibraryBooks(books)
      
      setSelectedBookId(id)
      setSelectedBookBlocks(finalBlocks)
      setSelectedBookMetadata({
        ...metadata,
        createdAt: Date.now(),
        lastReadAt: Date.now(),
      })
      
      triggerToast(`💾 Đã lưu sách "${title}" vào thư viện!`)
    } catch (err) {
      console.error('Lỗi tự động lưu sách:', err)
    }
  }

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)

        let title = file.name.replace(/\.json$/i, '')
        let blocksToImport: DocumentBlock[] = []
        let fType: 'pdf' | 'epub' = 'epub'

        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            blocksToImport = parsed
          } else if (parsed.blocks && Array.isArray(parsed.blocks)) {
            blocksToImport = parsed.blocks
            if (parsed.title) title = parsed.title
            if (parsed.metadata?.title) title = parsed.metadata.title
            if (parsed.fileType) fType = parsed.fileType
            if (parsed.metadata?.fileType) fType = parsed.metadata.fileType
          } else {
            throw new Error('Định dạng JSON không hợp lệ')
          }
        } else {
          throw new Error('Định dạng JSON không hợp lệ')
        }

        if (!blocksToImport.length) {
          throw new Error('Không tìm thấy nội dung trong file JSON')
        }

        const id = `book_${Date.now()}`
        const tCount = blocksToImport.filter(b => b.translatedText && !b.translatedText.startsWith('[CHƯA DỊCH]')).length
        const metadata: Omit<BookMetadata, 'createdAt' | 'lastReadAt'> = {
          id,
          title,
          fileType: fType,
          isFavorite: false,
          lastPage: 1,
          totalPages: Math.ceil(blocksToImport.length / 20),
          translatedCount: tCount,
        }

        await saveBookToLibrary(metadata, blocksToImport)
        triggerToast(`📥 Đã nhập sách "${title}" vào thư viện!`)
        loadLibrary()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi nhập file JSON')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleFileParsed = (parsedBlocks: DocumentBlock[], name: string, type: 'pdf' | 'epub') => {
    setBlocks(parsedBlocks)
    setFileName(name)
    setFileType(type)
    setStep('ready')
    setPartialTranslated([])
    setError('')
  }

  const handleResetChapterTranslation = (chapterId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa bản dịch hiện tại của chương này để dịch lại?')) {
      const chapterMap = getBlockChapterMap(blocks)
      setBlocks(prev =>
        prev.map(b =>
          chapterMap[b.id] === chapterId
            ? { ...b, translatedText: undefined, cefrAnnotatedTranslation: undefined }
            : b
        )
      )
      triggerToast('🧹 Đã xóa bản dịch cũ của chương này!')
    }
  }

  const runTranslation = async (
    workingBlocks: DocumentBlock[],
    signal: AbortSignal,
    onComplete: (blocks: DocumentBlock[]) => void
  ) => {
    // Chọn API key phù hợp:
    // - Nếu đã có cacheName (context cache tạo bằng paid key): dùng paid key để truy cập cache
    // - Nếu không có cache: dùng free key để dịch thông thường (tiết kiệm chi phí)
    const geminiApiKey = apiConfig?.provider === 'gemini'
      ? (cacheNameRef.current && apiConfig.geminiPaidApiKey)
        ? apiConfig.geminiPaidApiKey   // Đã có cache → paid key để access cache
        : (apiConfig.geminiFreeApiKey || apiConfig.geminiPaidApiKey || apiConfig.apiKey) // Không cache → ưu tiên free key
      : apiConfig?.apiKey

    const activeConfig = {
      ...apiConfig,
      apiKey: geminiApiKey || apiConfig?.apiKey || ''
    }

    const configWithCache = cacheNameRef.current
      ? { ...activeConfig, cacheName: cacheNameRef.current }
      : activeConfig

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
    // Bỏ qua Context Caching đối với Gemini Free để tối ưu hóa tốc độ và giảm thiểu độ trễ
    const isGeminiFree = apiConfig.provider === 'gemini' && !apiConfig.geminiPaidApiKey
    if (apiConfig.provider === 'gemini' && !isGeminiFree) {
      setIsCaching(true)
      try {
        const cacheConfig = {
          ...apiConfig,
          apiKey: apiConfig.geminiPaidApiKey || apiConfig.apiKey
        }
        const cacheRes = await fetch('/api/translate/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, config: cacheConfig }),
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
    const chapterMap = getBlockChapterMap(workingBlocks)
    
    // Chỉ dịch các câu thuộc chương được chọn và chưa được dịch (hoặc đã được reset)
    const remaining = workingBlocks.filter(b => {
      const chapterId = chapterMap[b.id] || 'intro'
      const isChapterSelected = selectedChapters.includes(chapterId)
      const isUntranslated = !b.translatedText || b.translatedText.startsWith('[CHƯA DỊCH]')
      return b.type !== 'code' && b.type !== 'image' && isChapterSelected && isUntranslated
    })

    if (remaining.length === 0) {
      setPartialTranslated(workingBlocks)
      await autoSaveToLibrary(workingBlocks)
      setStep('done')
      triggerToast('🎉 Các chương được chọn đã dịch hoàn chỉnh!')
      return
    }

    setPartialTranslated(workingBlocks)
    setProgress({
      completed: 0,
      total: remaining.length,
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let finalMerged: DocumentBlock[] = []
      await runTranslation(remaining, controller.signal, (translated) => {
        setPartialTranslated(prev => {
          const merged = prev.map(b => {
            const updated = translated.find(t => t.id === b.id)
            if (!updated?.translatedText) return b
            return {
              ...b,
              translatedText: updated.translatedText,
              ...(updated.cefrAnnotatedOriginal && { cefrAnnotatedOriginal: updated.cefrAnnotatedOriginal }),
              ...(updated.cefrAnnotatedTranslation && { cefrAnnotatedTranslation: updated.cefrAnnotatedTranslation }),
            }
          })
          finalMerged = merged
          return merged
        })
      })
      if (finalMerged.length > 0) {
        await autoSaveToLibrary(finalMerged)
      }
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
    // Bỏ qua Context Caching đối với Gemini Free để tối ưu tốc độ và giảm thiểu độ trễ
    const isGeminiFree = apiConfig.provider === 'gemini' && !apiConfig.geminiPaidApiKey
    if (apiConfig.provider === 'gemini' && !isGeminiFree && !cacheNameRef.current) {
      setIsCaching(true)
      try {
        const cacheConfig = {
          ...apiConfig,
          apiKey: apiConfig.geminiPaidApiKey || apiConfig.apiKey
        }
        const cacheRes = await fetch('/api/translate/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, config: cacheConfig }),
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
      let finalMerged: DocumentBlock[] = []
      await runTranslation(remaining, controller.signal, (translated) => {
        setPartialTranslated(prev => {
          const merged = prev.map(b => {
            const updated = translated.find(t => t.id === b.id)
            if (!updated?.translatedText) return b
            return {
              ...b,
              translatedText: updated.translatedText,
              ...(updated.cefrAnnotatedOriginal && { cefrAnnotatedOriginal: updated.cefrAnnotatedOriginal }),
              ...(updated.cefrAnnotatedTranslation && { cefrAnnotatedTranslation: updated.cefrAnnotatedTranslation }),
            }
          })
          finalMerged = merged
          return merged
        })
      })
      if (finalMerged.length > 0) {
        await autoSaveToLibrary(finalMerged)
      }
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

        {/* Main Tabs Navigation */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 max-w-lg mx-auto md:mx-0 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setActiveTab('translate')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'translate'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/25 border border-blue-400/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>⚡ Dịch sách</span>
          </button>
          <button
            onClick={() => setActiveTab('read')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'read'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/25 border border-blue-400/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>📖 Đọc sách</span>
          </button>
          <button
            onClick={() => setActiveTab('vocab')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'vocab'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/25 border border-blue-400/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>📓 Sổ tay từ vựng</span>
          </button>
        </div>

        {activeTab === 'vocab' ? (
          <VocabNotebook />
        ) : activeTab === 'read' ? (
          // Chế độ đọc sách song ngữ độc lập từ Thư viện (IndexedDB)
          selectedBookId ? (
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex justify-between items-center text-sm shadow-md">
                <span className="text-gray-300 font-medium truncate pr-4">📄 Đang đọc: {selectedBookMetadata?.title || fileName}</span>
                <button
                  onClick={() => {
                    setSelectedBookId(null)
                    setSelectedBookBlocks([])
                    setSelectedBookMetadata(null)
                    loadLibrary()
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-semibold shrink-0"
                >
                  ◀ Quay lại thư viện
                </button>
              </div>
              <DocumentPreview
                blocks={selectedBookBlocks}
                bilingual={bilingual}
                bookId={selectedBookId}
                initialPage={selectedBookMetadata?.lastPage || 1}
                onPageChange={async (page) => {
                  if (selectedBookId) {
                    await updateReadingProgress(selectedBookId, page)
                    setLibraryBooks(prev =>
                      prev.map(b => (b.id === selectedBookId ? { ...b, lastPage: page, lastReadAt: Date.now() } : b))
                    )
                  }
                }}
                onBackToLibrary={() => {
                  setSelectedBookId(null)
                  setSelectedBookBlocks([])
                  setSelectedBookMetadata(null)
                  loadLibrary()
                }}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Library Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-wide">📚 THƯ VIỆN SÁCH CỦA BẠN</h2>
                  <p className="text-gray-400 text-xs mt-1 font-light">
                    Lưu trữ ngoại tuyến trên trình duyệt (IndexedDB). Tự động lưu trang đang đọc dở.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl border border-blue-400/20 shadow-md shadow-blue-500/10 cursor-pointer transition-all active:scale-95 shrink-0 select-none">
                    <span>📥 Thêm sách mới (EPUB/PDF)</span>
                    <input
                      type="file"
                      accept=".epub,.pdf"
                      onChange={handleEpubImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/5 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 shadow-lg">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-500 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm sách trong thư viện..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-black/35 border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all font-light"
                  />
                </div>
                
                {/* Filter Switcher */}
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 shrink-0 self-start md:self-auto">
                  <button
                    onClick={() => setLibraryFilter('all')}
                    className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
                      libraryFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Tất cả ({libraryBooks.length})
                  </button>
                  <button
                    onClick={() => setLibraryFilter('favorites')}
                    className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      libraryFilter === 'favorites'
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ❤️ Yêu thích ({libraryBooks.filter(b => b.isFavorite).length})
                  </button>
                </div>
              </div>

              {/* Grid of Books */}
              {(() => {
                const filteredBooks = libraryBooks.filter(book => {
                  const matchesSearch = book.title.toLowerCase().includes(librarySearch.toLowerCase())
                  const matchesFilter = libraryFilter === 'all' || book.isFavorite
                  return matchesSearch && matchesFilter
                })

                if (filteredBooks.length === 0) {
                  return (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center space-y-4 max-w-md mx-auto my-6 shadow-xl">
                      <span className="text-4xl inline-block">📭</span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide">Thư viện trống</h3>
                        <p className="text-gray-500 text-xs font-light max-w-xs mx-auto leading-relaxed">
                          {librarySearch 
                            ? 'Không tìm thấy sách nào khớp với từ khóa tìm kiếm của bạn.' 
                            : 'Hãy chuyển sang tab Dịch sách hoặc bấm Nhập sách dịch từ file JSON để điền đầy thư viện nhé!'}
                        </p>
                      </div>
                      {!librarySearch && (
                        <button
                          onClick={() => setActiveTab('translate')}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                        >
                          ⚡ Đi dịch sách ngay
                        </button>
                      )}
                    </div>
                  )
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBooks.map((book) => {
                      const readPercent = Math.min(100, Math.round((book.lastPage / book.totalPages) * 100))
                      
                      return (
                        <div
                          key={book.id}
                          className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20 hover:-translate-y-1 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-indigo-500/0 to-purple-500/5 group-hover:to-purple-500/10 transition-all pointer-events-none" />
                          
                          <div className="flex items-center justify-between gap-2 mb-4 z-10">
                            <span className="text-[9px] uppercase tracking-wider font-mono font-bold bg-white/10 text-blue-300 px-2 py-0.5 rounded-full border border-white/5">
                              {book.fileType.toUpperCase()}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleToggleFavorite(book.id, e)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-400 active:scale-90 transition-all"
                                title="Yêu thích"
                              >
                                {book.isFavorite ? '❤️' : '🤍'}
                              </button>
                              <button
                                onClick={(e) => handleDeleteBook(book.id, book.title, e)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-500 active:scale-90 transition-all text-xs"
                                title="Xóa sách"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4 z-10 flex-1">
                            <div className="space-y-1.5">
                              <h3 
                                onClick={() => handleOpenBook(book)}
                                className="font-bold text-sm text-white tracking-tight group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-2 leading-snug"
                                title={book.title}
                              >
                                {book.title}
                              </h3>
                              <p className="text-[10px] text-gray-500 font-light">
                                Lần cuối đọc: {new Date(book.lastReadAt).toLocaleDateString('vi-VN')}
                              </p>
                            </div>

                            <div className="space-y-2.5 pt-2">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gray-400 font-light">
                                  <span>Trang đang đọc: <strong className="text-gray-200 font-medium">{book.lastPage} / {book.totalPages}</strong></span>
                                  <span>{readPercent}%</span>
                                </div>
                                <div className="h-1.5 bg-black/35 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${readPercent}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-gray-400 font-light bg-black/25 px-3 py-1.5 rounded-xl border border-white/5">
                                <span>Tiến trình dịch:</span>
                                <span className="text-indigo-300 font-medium font-mono">{book.translatedCount} câu song ngữ</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-white/5 z-10 flex gap-2">
                            <button
                              onClick={() => handleOpenBook(book)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-white text-[11px] font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-300 active:scale-95"
                            >
                              <span>📖</span>
                              <span>{book.lastPage > 1 ? 'Đọc tiếp' : 'Đọc gốc'}</span>
                            </button>
                            <button
                              onClick={() => handleTranslateBookFromLibrary(book)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold rounded-xl border border-blue-400/20 shadow-md shadow-blue-500/10 transition-all duration-300 active:scale-95"
                            >
                              <span>⚡</span>
                              <span>Dịch song ngữ</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )
        ) : (
          <>
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

            {/* Chapter Selector Section */}
            {blocks.length > 0 && (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase">📖 DANH SÁCH CHƯƠNG</h3>
                  <p className="text-gray-400 text-xs mt-1 font-light">
                    Chọn các chương bạn muốn dịch. Bạn có thể xóa bản dịch lỗi của một chương cụ thể để dịch lại.
                  </p>
                </div>



                <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl bg-black/25">
                  {getChapters(blocks).map((ch) => {
                    const isSelected = selectedChapters.includes(ch.href)
                    const percent = ch.blocksCount > 0 ? Math.round((ch.translatedCount / ch.blocksCount) * 100) : 0
                    
                    return (
                      <div key={ch.href} className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChapters(prev => [...prev, ch.href])
                              } else {
                                setSelectedChapters(prev => prev.filter(h => h !== ch.href))
                              }
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-black/50 text-blue-600 focus:ring-blue-500 focus:ring-offset-black cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-white font-medium text-xs truncate" title={ch.title}>
                              {ch.title}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {ch.translatedCount}/{ch.blocksCount} câu song ngữ ({percent}%)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {ch.isCompleted ? (
                            <span className="text-[9px] font-mono bg-green-500/10 text-green-300 px-2 py-0.5 rounded-full border border-green-500/20 font-bold">
                              Hoàn thành
                            </span>
                          ) : ch.translatedCount > 0 ? (
                            <span className="text-[9px] font-mono bg-yellow-500/10 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold">
                              Dịch dở
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/5">
                              Chưa dịch
                            </span>
                          )}

                          {ch.translatedCount > 0 && (
                            <button
                              onClick={() => handleResetChapterTranslation(ch.href)}
                              className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 transition-all font-semibold active:scale-95"
                              title="Xóa toàn bộ câu dịch của chương này để dịch lại"
                            >
                              🔄 Reset
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={handleTranslate}
                disabled={!apiConfig || selectedChapters.length === 0}
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

              {apiConfig && selectedChapters.length === 0 && (
                <span className="text-yellow-400 text-sm">⚠️ Hãy chọn ít nhất một chương để dịch</span>
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
              usingCache={!!(cacheNameRef.current && apiConfig?.geminiPaidApiKey)}
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

            {/* Completed Dashboard and CTA to Reader Mode */}
            <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/30 rounded-3xl p-8 text-center space-y-5 shadow-xl my-4">
              <span className="text-5xl inline-block animate-pulse">🎉</span>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white tracking-wide">DỊCH SÁCH THÀNH CÔNG!</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto font-light leading-relaxed">
                  Bản dịch song ngữ của bạn đã hoàn tất và sẵn sàng. Bạn có thể tải file thành phẩm về ở thanh công cụ phía trên hoặc mở chế độ đọc tập trung để học ngay lập tức.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setActiveTab('read')}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:from-blue-400 hover:to-purple-400 transition-all duration-300 transform hover:scale-[1.02] text-sm"
                >
                  📖 Bắt đầu đọc sách ngay (Reader Mode)
                </button>
              </div>
            </div>
          </section>
        )}
          </>
        )}
      {/* Floating Success Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 border border-green-500/30 text-green-300 text-sm font-semibold rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-6 duration-200">
          <span>✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Importing Loader Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-blue-500/30 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-blue-500/10">
            <span className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-blue-500/20 text-3xl animate-spin">
              🌀
            </span>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-wide">
                ĐANG PHÂN TÍCH SÁCH...
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed font-light">
                {importInfo || 'Đang trích xuất nội dung từ file EPUB/PDF. Quá trình này diễn ra hoàn toàn cục bộ trên trình duyệt.'}
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  )
}
