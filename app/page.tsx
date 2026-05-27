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

export type SplitMode = 'combined' | 'file' | 'heading12' | 'heading123'

interface ChapterInfo {
  href: string // Unique identifier for the chapter
  title: string
  blocksCount: number
  translatedCount: number
  isCompleted: boolean
  firstBlockIndex: number
}

function applySplitMode(docBlocks: DocumentBlock[], splitMode: SplitMode): DocumentBlock[] {
  let currentChapterHref = 'intro'
  let lastHref = ''
  
  return docBlocks.map(block => {
    const blockHref = (block.metadata?.chapterHref as string) || 'default_chapter'
    
    let shouldSplit = false
    if (splitMode === 'file') {
      shouldSplit = lastHref !== '' && lastHref !== blockHref
    } else if (splitMode === 'heading12') {
      shouldSplit = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
    } else if (splitMode === 'heading123') {
      shouldSplit = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2 || block.style.level === 3)
    } else { // combined
      const isNewFile = lastHref !== '' && lastHref !== blockHref
      const isNewHeading = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
      shouldSplit = isNewFile || isNewHeading
    }
    
    if (shouldSplit) {
      currentChapterHref = `chapter_${block.id}`
    }
    
    lastHref = blockHref
    
    return {
      ...block,
      metadata: {
        ...block.metadata,
        chapterHref: currentChapterHref
      }
    }
  })
}

function getChapters(docBlocks: DocumentBlock[], splitMode: SplitMode = 'combined'): ChapterInfo[] {
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
    
    let isNewChapter = false
    if (splitMode === 'file') {
      isNewChapter = lastHref !== '' && lastHref !== blockHref
    } else if (splitMode === 'heading12') {
      isNewChapter = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
    } else if (splitMode === 'heading123') {
      isNewChapter = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2 || block.style.level === 3)
    } else { // combined
      const isNewFile = lastHref !== '' && lastHref !== blockHref
      const isNewHeading = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
      isNewChapter = isNewFile || isNewHeading
    }

    if (isNewChapter) {
      // Save previous chapter if it had blocks
      if (currentChapter.blocksCount > 0) {
        chapters.push({
          ...currentChapter,
          isCompleted: currentChapter.blocksCount === currentChapter.translatedCount,
        })
      }

      currentChapter = {
        href: block.id, // Dùng ID của block làm định danh chương duy nhất
        title: block.type === 'heading' ? block.originalText : `Chương ${chapters.length + 1}`,
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

function getBlockChapterMap(docBlocks: DocumentBlock[], splitMode: SplitMode = 'combined'): Record<string, string> {
  const map: Record<string, string> = {}
  let currentChapterId = 'intro'
  let lastHref = ''

  docBlocks.forEach((block) => {
    const blockHref = (block.metadata?.chapterHref as string) || 'default_chapter'
    
    let isNewChapter = false
    if (splitMode === 'file') {
      isNewChapter = lastHref !== '' && lastHref !== blockHref
    } else if (splitMode === 'heading12') {
      isNewChapter = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
    } else if (splitMode === 'heading123') {
      isNewChapter = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2 || block.style.level === 3)
    } else { // combined
      const isNewFile = lastHref !== '' && lastHref !== blockHref
      const isNewHeading = block.type === 'heading' && (block.style.level === 1 || block.style.level === 2)
      isNewChapter = isNewFile || isNewHeading
    }

    if (isNewChapter) {
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
  const [splitMode, setSplitMode] = useState<SplitMode>('combined')
  const abortRef = useRef<AbortController | null>(null)
  const cacheNameRef = useRef<string | null>(null)

  const [libraryBooks, setLibraryBooks] = useState<BookMetadata[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedBookBlocks, setSelectedBookBlocks] = useState<DocumentBlock[]>([])
  const [selectedBookMetadata, setSelectedBookMetadata] = useState<BookMetadata | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites'>('all')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  // Force light theme and disable dark mode
  const theme = 'light'

  useEffect(() => {
    document.documentElement.classList.add('light-theme')
    document.documentElement.classList.remove('dark')
    localStorage.setItem('dich-sach-theme', 'light')
  }, [])

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
    setSplitMode('combined')
  }

  const handleResetChapterTranslation = (chapterId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa bản dịch hiện tại của chương này để dịch lại?')) {
      const chapterMap = getBlockChapterMap(blocks, splitMode)
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

    // Đăng ký sự kiện abort để hủy stream reader ngay lập tức khi người dùng bấm tạm dừng
    const onAbort = () => {
      try {
        reader.cancel()
      } catch (err) {
        console.error('Lỗi khi hủy stream reader:', err)
      }
    }
    signal.addEventListener('abort', onAbort)

    try {
      while (true) {
        if (signal.aborted) {
          throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
        }
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
    } finally {
      signal.removeEventListener('abort', onAbort)
    }

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

    const splitBlocks = applySplitMode(blocks, splitMode)
    const workingBlocks = bilingual ? expandForBilingual(splitBlocks) : splitBlocks
    const chapterMap = getBlockChapterMap(workingBlocks, splitMode)
    
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
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        setStep(prev => prev === 'translating' ? 'paused' : prev)
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định')
        setStep(prev => prev === 'translating' ? 'ready' : prev)
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  const handlePause = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      setStep('paused')
    }
  }

  const handleResume = async () => {
    if (!apiConfig) { setError('Vui lòng cài đặt API key trước.'); return }

    const chapterMap = getBlockChapterMap(partialTranslated, splitMode)
    const remaining = partialTranslated.filter(b => {
      const chapterId = chapterMap[b.id] || 'intro'
      const isChapterSelected = selectedChapters.includes(chapterId)
      const isUntranslated = !b.translatedText || b.translatedText.startsWith('[CHƯA DỊCH]')
      return b.type !== 'code' && b.type !== 'image' && isChapterSelected && isUntranslated
    })

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
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        setStep(prev => prev === 'translating' ? 'paused' : prev)
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định')
        setStep(prev => prev === 'translating' ? 'paused' : prev)
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
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
    <main className="min-h-screen bg-[#f5f5f7] dark:bg-[#121214] text-[#1d1d1f] dark:text-[#ffffff] relative overflow-hidden apple-font-text transition-colors duration-300">
      
      {/* Thin Apple Global Nav (56px) */}
      <nav 
        className="h-[56px] border-b border-white/10 flex items-center px-6 sticky top-0 z-50 justify-between select-none shadow-sm"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 40%, #0d9488 100%)' }}
      >
        <div className="flex items-center gap-6">
          <span className="text-yellow-300 font-bold text-[18px] tracking-wider cursor-pointer hover:opacity-80 active-scale transition-all flex items-center gap-1.5" onClick={() => resetToUpload()}>
            <span>📖</span>
            <span className="font-mono">Tác giả: Trần Trí Nhân</span>
          </span>
          <div className="hidden md:flex items-center gap-6 text-[18px] text-white/85 font-light tracking-wide">
            <span className={`hover:text-yellow-300 cursor-pointer transition-colors ${activeTab === 'translate' ? 'text-yellow-300 font-bold' : ''}`} onClick={() => { setActiveTab('translate'); setSelectedBookId(null); }}>⚡ Dịch sách</span>
            <span className={`hover:text-yellow-300 cursor-pointer transition-colors ${activeTab === 'read' ? 'text-yellow-300 font-bold' : ''}`} onClick={() => { setActiveTab('read'); setSelectedBookId(null); }}>📚 Thư viện</span>
            <span className={`hover:text-yellow-300 cursor-pointer transition-colors ${activeTab === 'vocab' ? 'text-yellow-300 font-bold' : ''}`} onClick={() => { setActiveTab('vocab'); setSelectedBookId(null); }}>📓 Sổ tay từ vựng</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
        </div>
      </nav>

      {/* Apple Sub-Nav (52px) */}
      <div 
        className="h-[52px] sticky top-[56px] z-40 border-b border-white/10 flex items-center justify-between px-6 shadow-md"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 40%, #0d9488 100%)' }}
      >
        <div className="flex items-center gap-3">
          <span className="font-serif font-semibold text-[18px] text-yellow-300 tracking-tight">
            {fileName ? `📄 ${fileName.replace(/\.(pdf|epub)$/i, '')}` : "📖 Dịch Sách Song Ngữ"}
          </span>
          {step !== 'upload' && activeTab === 'translate' && (
            <span className="text-[10px] uppercase font-mono tracking-widest bg-white/20 text-yellow-300 px-2.5 py-0.5 rounded-full font-bold border border-white/20 shadow-sm">
              {fileType.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-8">
        
        {activeTab === 'vocab' ? (
          <VocabNotebook />
        ) : activeTab === 'read' ? (
          // Chế độ đọc sách song ngữ độc lập từ Thư viện (IndexedDB)
          selectedBookId ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-4 flex justify-between items-center text-sm shadow-sm">
                <span className="text-gray-900 dark:text-white font-semibold truncate pr-4">📄 Đang đọc: {selectedBookMetadata?.title || fileName}</span>
                <button
                  onClick={() => {
                    setSelectedBookId(null)
                    setSelectedBookBlocks([])
                    setSelectedBookMetadata(null)
                    loadLibrary()
                  }}
                  className="text-xs text-[#0066cc] dark:text-[#2997ff] hover:underline font-bold shrink-0"
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white apple-font-display">📚 THƯ VIỆN SÁCH CỦA BẠN</h2>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-light">
                    Lưu trữ ngoại tuyến trên trình duyệt (IndexedDB). Tự động lưu trang đang đọc dở.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-5 py-2.5 bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-bold rounded-full shadow-sm cursor-pointer transition-all active-scale shrink-0 select-none">
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] px-5 py-3 shadow-sm">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm sách trong thư viện..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#f5f5f7] dark:bg-black/35 border border-black/5 dark:border-white/5 rounded-full text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc] font-light"
                  />
                </div>
                
                {/* Filter Switcher */}
                <div className="flex bg-[#f5f5f7] dark:bg-black/20 p-1 rounded-full border border-black/5 dark:border-white/5 shrink-0 self-start md:self-auto select-none">
                  <button
                    onClick={() => setLibraryFilter('all')}
                    className={`text-xs px-4 py-1.5 rounded-full font-bold transition-all ${
                      libraryFilter === 'all'
                        ? 'bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Tất cả ({libraryBooks.length})
                  </button>
                  <button
                    onClick={() => setLibraryFilter('favorites')}
                    className={`text-xs px-4 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 ${
                      libraryFilter === 'favorites'
                        ? 'bg-pink-500/10 text-pink-600 dark:text-pink-300 border border-pink-500/20'
                        : 'text-gray-400 hover:text-pink-500'
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
                    <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-12 text-center space-y-4 max-w-md mx-auto my-6 shadow-sm">
                      <span className="text-4xl inline-block select-none">📭</span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wide">Thư viện trống</h3>
                        <p className="text-gray-400 dark:text-gray-500 text-xs font-light max-w-xs mx-auto leading-relaxed">
                          {librarySearch 
                            ? 'Không tìm thấy sách nào khớp với từ khóa tìm kiếm của bạn.' 
                            : 'Hãy tải lên file EPUB/PDF để bắt đầu đọc sách hoặc bấm Nhập sách dịch từ file JSON để điền đầy thư viện nhé!'}
                        </p>
                      </div>
                      {!librarySearch && (
                        <button
                          onClick={() => setActiveTab('translate')}
                          className="px-6 py-2.5 bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-bold rounded-full shadow-sm transition-all active-scale"
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
                          className="group relative bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 flex flex-col justify-between hover:border-black/10 dark:hover:border-white/10 transition-all duration-300 shadow-sm hover:-translate-y-0.5 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2 mb-4 z-10 select-none">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold bg-[#0066cc]/10 dark:bg-[#2997ff]/10 text-[#0066cc] dark:text-[#2997ff] px-2.5 py-0.5 rounded-full border border-[#0066cc]/10 dark:border-[#2997ff]/10">
                              {book.fileType.toUpperCase()}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleToggleFavorite(book.id, e)}
                                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-400 hover:text-pink-500 active-scale transition-all"
                                title="Yêu thích"
                              >
                                {book.isFavorite ? '❤️' : '🤍'}
                              </button>
                              <button
                                onClick={(e) => handleDeleteBook(book.id, book.title, e)}
                                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 active-scale transition-all text-xs"
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
                                className="font-bold text-[15px] text-gray-900 dark:text-white tracking-tight group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors cursor-pointer line-clamp-2 leading-snug apple-font-display"
                                title={book.title}
                              >
                                {book.title}
                              </h3>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-light select-none">
                                Lần cuối đọc: {new Date(book.lastReadAt).toLocaleDateString('vi-VN')}
                              </p>
                            </div>

                            <div className="space-y-3 pt-2">
                              <div className="space-y-1 select-none">
                                <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 font-light">
                                  <span>Trang đang đọc: <strong className="text-gray-800 dark:text-gray-200 font-bold">{book.lastPage} / {book.totalPages}</strong></span>
                                  <span>{readPercent}%</span>
                                </div>
                                <div className="h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-[#0066cc] rounded-full transition-all duration-300"
                                    style={{ width: `${readPercent}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-light bg-[#f5f5f7] dark:bg-black/25 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
                                <span>Tiến trình dịch:</span>
                                <span className="text-[#0066cc] dark:text-indigo-300 font-bold font-mono">{book.translatedCount} câu song ngữ</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-black/5 dark:border-white/5 z-10 flex gap-2 select-none">
                            <button
                              onClick={() => handleOpenBook(book)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-gray-900 dark:text-white text-[11px] font-bold rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 transition-all active-scale"
                            >
                              <span>📖</span>
                              <span>{book.lastPage > 1 ? 'Đọc tiếp' : 'Đọc gốc'}</span>
                            </button>
                            <button
                              onClick={() => handleTranslateBookFromLibrary(book)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-bold rounded-full border border-blue-400/20 shadow-sm transition-all active-scale"
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
              <div className="bg-red-500/10 border border-red-500/25 rounded-[18px] px-5 py-3 text-red-600 dark:text-red-300 text-xs flex items-center gap-3 backdrop-blur-md">
                <span className="text-sm">⚠️</span>
                <span className="font-medium flex-1">{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700 font-bold font-mono">✕</button>
              </div>
            )}

            {/* Warning banner */}
            {warningMessage && (
              <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-[18px] px-5 py-3 text-yellow-600 dark:text-yellow-300 text-xs flex items-center gap-3 backdrop-blur-md">
                <span className="text-sm">💡</span>
                <span className="font-medium flex-1">{warningMessage}</span>
                <button onClick={() => setWarningMessage(null)} className="ml-auto text-yellow-500 hover:text-yellow-700 font-bold font-mono">✕</button>
              </div>
            )}

            {/* Caching Shimmer Loader */}
            {isCaching && (
              <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 rounded-[22px] p-10 text-center space-y-5 shadow-2xl">
                <span className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#0066cc]/10 text-3xl animate-spin">
                  🌀
                </span>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white apple-font-display">
                    🔮 ĐANG TỐI ƯU CHI PHÍ VỚI CONTEXT CACHING...
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed font-light max-w-md mx-auto">
                    Đang đẩy nội dung sách gốc lên bộ đệm đám mây của Google AI Studio. 
                    Quá trình này chỉ diễn ra một lần và giúp giảm 90% chi phí API, đồng thời giúp AI ghi nhớ toàn bộ văn cảnh.
                  </p>
                </div>
              </div>
            )}

            {/* Step: Upload */}
            {step === 'upload' && !isCaching && (
              <section className="space-y-3">
                <h2 className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 select-none">
                  Bước 1: Tải lên tài liệu (.epub)
                </h2>
                <div className="rounded-[22px] overflow-hidden shadow-sm">
                  <FileUpload onFileParsed={handleFileParsed} />
                </div>
              </section>
            )}

            {/* Step: Ready to translate */}
            {step === 'ready' && (
              <section className="space-y-5">
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">📄 {fileName}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-medium">{blocks.length} đoạn văn · {fileType.toUpperCase()}</p>
                  </div>
                  <button onClick={resetToUpload} className="px-5 py-2 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-full font-bold active-scale text-xs transition-all">
                    Đổi file
                  </button>
                </div>

                {/* Chapter Selector Section */}
                {blocks.length > 0 && (
                  <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 space-y-5 shadow-sm">
                    <div className="border-b border-black/5 dark:border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-wide uppercase">📖 DANH SÁCH CHƯƠNG</h3>
                        <p className="text-gray-400 dark:text-gray-500 text-xs font-light">Chọn các chương bạn muốn dịch hoặc xóa bản dịch cũ để dịch lại.</p>
                      </div>
                      {blocks.length > 0 && (() => {
                        const chs = getChapters(blocks, splitMode)
                        const allSelected = chs.length > 0 && chs.every(ch => selectedChapters.includes(ch.href))
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                setSelectedChapters([])
                              } else {
                                setSelectedChapters(chs.map(ch => ch.href))
                              }
                            }}
                            className="text-xs px-4 py-2 bg-[#0066cc]/10 hover:bg-[#0066cc]/15 text-[#0066cc] rounded-full border border-[#0066cc]/15 font-bold active-scale transition-all select-none self-start sm:self-auto"
                          >
                            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả các chương'}
                          </button>
                        )
                      })()}
                    </div>

                    {/* Active Chapter Splitting Selector */}
                    {fileType === 'epub' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f5f5f7] dark:bg-black/25 p-4 rounded-[18px] border border-black/5 dark:border-white/5 shadow-inner">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-800 dark:text-gray-300 flex items-center gap-1.5 select-none">
                            ⚙️ Chế độ phân chia chương
                          </label>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-light">
                            Lựa chọn cách thức gom nhóm nội dung thành từng chương phù hợp nhất với cấu trúc của sách.
                          </p>
                        </div>
                        <select
                          value={splitMode}
                          onChange={(e) => {
                            const newMode = e.target.value as SplitMode
                            setSplitMode(newMode)
                            setSelectedChapters([])
                          }}
                          className="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-full px-4 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066cc] font-bold cursor-pointer shadow-sm select-none"
                        >
                          <option value="combined">Kết hợp cả File & Tiêu đề (Mặc định)</option>
                          <option value="file">Chỉ theo cấu trúc File gốc (XHTML)</option>
                          <option value="heading12">Theo tiêu đề lớn (H1, H2)</option>
                          <option value="heading123">Theo tất cả tiêu đề (H1, H2, H3)</option>
                        </select>
                      </div>
                    )}

                    <div className="max-h-[300px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5 border border-black/5 dark:border-white/5 rounded-[18px] bg-[#f5f5f7]/50 dark:bg-black/25">
                      {getChapters(blocks, splitMode).map((ch) => {
                        const isSelected = selectedChapters.includes(ch.href)
                        const percent = ch.blocksCount > 0 ? Math.round((ch.translatedCount / ch.blocksCount) * 100) : 0
                        
                        return (
                          <div key={ch.href} className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-4">
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
                                className="w-4 h-4 rounded border-black/15 dark:border-white/10 bg-white dark:bg-black/50 text-[#0066cc] focus:ring-[#0066cc] cursor-pointer"
                              />
                              <div className="min-w-0 select-none">
                                <p className="text-gray-900 dark:text-white font-semibold text-xs truncate" title={ch.title}>
                                  {ch.title}
                                </p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                                  {ch.translatedCount}/{ch.blocksCount} câu song ngữ ({percent}%)
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 select-none">
                              {ch.isCompleted ? (
                                <span className="text-[8px] uppercase font-mono bg-green-500/10 text-green-600 dark:text-green-300 px-2.5 py-0.5 rounded-full border border-green-500/15 font-bold">
                                  Hoàn thành
                                </span>
                              ) : ch.translatedCount > 0 ? (
                                <span className="text-[8px] uppercase font-mono bg-yellow-500/10 text-yellow-600 dark:text-yellow-300 px-2.5 py-0.5 rounded-full border border-yellow-500/15 font-bold">
                                  Dịch dở
                                </span>
                              ) : (
                                <span className="text-[8px] uppercase font-mono bg-black/5 dark:bg-white/5 text-gray-400 dark:text-gray-500 px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/5">
                                  Chưa dịch
                                </span>
                              )}

                              {ch.translatedCount > 0 && (
                                <button
                                  onClick={() => handleResetChapterTranslation(ch.href)}
                                  className="text-[9px] text-red-600 dark:text-red-300 bg-red-500/10 hover:bg-red-500/15 px-2.5 py-1 rounded-full border border-red-500/15 transition-all font-bold active-scale"
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

                <div className="flex flex-wrap gap-3 items-center select-none">
                  <button
                    onClick={handleTranslate}
                    disabled={!apiConfig || selectedChapters.length === 0}
                    className="px-7 py-3 bg-[#0066cc] text-white rounded-full font-bold hover:bg-[#0071e3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm active-scale text-xs"
                  >
                    ▶ Bắt đầu dịch
                  </button>

                  <button
                    onClick={() => setBilingual(b => !b)}
                    className={`px-6 py-3 rounded-full font-bold text-xs transition-colors active-scale border ${
                      bilingual
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20'
                        : 'bg-black/5 text-gray-900 hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 border-black/5 dark:border-white/5'
                    }`}
                  >
                    {bilingual ? '🔤 Song ngữ Bật' : '🔤 Song ngữ Tắt'}
                  </button>

                  {bilingual && (
                    <span className="text-purple-600 dark:text-purple-300 text-[11px] font-bold">
                      Mỗi đoạn 1 câu · xuất kèm bản gốc tiếng Anh
                    </span>
                  )}

                  {!apiConfig && (
                    <span className="text-yellow-600 dark:text-yellow-400 text-[11px] font-bold">← Cần cài đặt API key trước</span>
                  )}

                  {apiConfig && selectedChapters.length === 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400 text-[11px] font-bold">⚠️ Hãy chọn ít nhất một chương để dịch</span>
                  )}
                </div>
              </section>
            )}

            {/* Step: Translating */}
            {step === 'translating' && (
              <section className="space-y-4">
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 flex items-center justify-between gap-4 shadow-sm select-none">
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">📄 {fileName}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-medium font-mono">
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
              <section className="space-y-5">
                {/* Status card */}
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 select-none">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#ff9500] font-bold text-sm">⏸ Đã tạm dừng · {fileName}</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-medium">
                        Đã dịch {translatedCount} / {totalCount} đoạn
                        {totalCount > 0 && (
                          <span className="ml-2 text-[#ff9500]/90 font-mono font-bold">
                            ({Math.round((translatedCount / totalCount) * 100)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        onClick={handleResume}
                        disabled={!apiConfig}
                        className="px-6 py-2.5 bg-[#0066cc] text-white rounded-full font-bold hover:bg-[#0071e3] disabled:opacity-40 transition-colors shadow-sm active-scale text-xs"
                      >
                        ▶ Dịch tiếp
                      </button>
                      <button
                        onClick={resetToUpload}
                        className="px-5 py-2.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-full font-bold active-scale text-xs transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="mt-4 h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden select-none">
                    <div
                      className="h-full bg-gradient-to-r from-[#ff9500] to-[#ffcc00] rounded-full transition-all"
                      style={{ width: `${totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Export partial results */}
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 shadow-sm">
                  <p className="text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider mb-4 select-none">
                    📦 Xuất file {translatedCount > 0 ? `(${translatedCount} đoạn đã dịch)` : ''}
                  </p>
                  {translatedCount === 0 ? (
                    <p className="text-yellow-600 dark:text-yellow-400 text-xs font-medium select-none">
                      Chưa có đoạn nào hoàn thành. Bấm <span className="font-extrabold text-[#0066cc]">▶ Dịch tiếp</span> để dịch thêm rồi tạm dừng lại để xuất.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3 items-center select-none">
                      {(['epub', 'html', 'docx', 'pdf'] as ExportFormat[]).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setExportFormat(fmt)}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                            exportFormat === fmt
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20'
                              : 'bg-black/5 text-gray-900 hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 border-black/5 dark:border-white/5'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                      <button
                        onClick={() => handleExport()}
                        disabled={exporting}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold disabled:opacity-50 transition-colors shadow-sm active-scale text-xs"
                      >
                        {exporting ? '⏳ Đang tạo...' : '⬇ Tải về'}
                      </button>
                      {exportFormat === 'pdf' && (
                        <p className="text-yellow-600 dark:text-yellow-400 text-[11px] font-bold mt-1 w-full">
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
              <section className="space-y-6">
                {/* Export bar */}
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[22px] p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm select-none">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                      ✅ Dịch xong: {fileName}
                      {bilingual && <span className="ml-2.5 text-[8px] uppercase tracking-wider font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/15">Song ngữ</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-gray-400 dark:text-gray-500 text-xs font-bold">Xuất ra:</span>
                    {(['html', 'epub', 'docx', 'pdf'] as ExportFormat[]).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                          exportFormat === fmt
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20'
                            : 'bg-black/5 text-gray-900 hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 border-black/5 dark:border-white/5'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}

                    <button
                      onClick={() => handleExport()}
                      disabled={exporting}
                      className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold disabled:opacity-50 transition-colors shadow-sm active-scale text-xs"
                    >
                      {exporting ? '⏳ Đang tạo...' : '⬇ Tải về'}
                    </button>

                    <button
                      onClick={resetToUpload}
                      className="px-5 py-2.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white rounded-full font-bold active-scale text-xs transition-colors"
                    >
                      File mới
                    </button>
                  </div>
                </div>

                {exportFormat === 'pdf' && (
                  <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-[18px] px-5 py-3 text-yellow-600 dark:text-yellow-300 text-xs font-bold select-none">
                    💡 Lần đầu xuất PDF sẽ tự động tải bộ font Unicode tiếng Việt (~1.5MB). Bạn có thể tải file HTML rồi in bằng trình duyệt (Print to PDF) để có chất lượng sắc nét nhất.
                  </div>
                )}

                {/* Museum Gallery Style Celebration Banner */}
                <div className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 rounded-[22px] p-10 text-center space-y-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-iphone-ambient-glow pointer-events-none" />
                  <span className="text-6xl inline-block animate-bounce relative z-10 select-none">🎉</span>
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white apple-font-display">DỊCH SÁCH THÀNH CÔNG!</h3>
                    <p className="text-[15px] text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-light leading-relaxed">
                      Bản dịch song ngữ của bạn đã hoàn tất và được lưu trữ tự động vào Thư viện IndexedDB. Bạn có thể tải file thành phẩm về ở thanh công cụ phía trên hoặc mở chế độ đọc song ngữ để học ngoại ngữ ngay lập tức.
                    </p>
                  </div>
                  <div className="flex justify-center relative z-10 pt-2 select-none">
                    <button
                      onClick={() => setActiveTab('read')}
                      className="px-8 py-3.5 bg-iphone-neon hover:bg-iphone-neon-hover text-white font-bold rounded-full shadow-lg transition-all duration-300 active-scale text-xs"
                    >
                      📖 Bắt đầu đọc sách ngay (Reader Mode)
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Floating Success Toast (Apple style notifications) */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-[#fafafc] dark:bg-[#272729] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-6 duration-200 select-none">
          <span className="text-sm">✅</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Importing Loader Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="bg-[#fafafc] dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 rounded-[18px] p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#0066cc]/10 text-3xl animate-spin">
              🌀
            </span>
            <div className="space-y-2">
              <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-wide">
                ĐANG PHÂN TÍCH SÁCH...
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed font-light">
                {importInfo || 'Đang thực hiện trích xuất nội dung từ file EPUB/PDF. Quá trình xử lý chạy hoàn toàn cục bộ trên thiết bị của bạn.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

