export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'table-cell'
  | 'caption'
  | 'code'
  | 'image'

export interface BlockStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  color?: string
  alignment?: 'left' | 'center' | 'right' | 'justify'
  level?: number // heading level (1-6) or list depth
}

export interface DocumentBlock {
  id: string
  type: BlockType
  originalText: string
  translatedText?: string
  cefrAnnotatedOriginal?: string
  cefrAnnotatedTranslation?: string
  style: BlockStyle
  position?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  metadata?: Record<string, unknown>
}

export type AIProvider = 'deepseek' | 'gemini' | 'openai' | 'claude'
export type ExportFormat = 'html' | 'pdf' | 'epub' | 'docx'

export interface TranslationConfig {
  provider: AIProvider
  apiKey: string
  model?: string
  cefrAnnotation?: boolean
  cacheName?: string
  
  // Custom keys for separate model configurations
  geminiFreeApiKey?: string
  geminiPaidApiKey?: string
  deepseekApiKey?: string
  openaiApiKey?: string
  claudeApiKey?: string

  // Cấu hình nâng cao cho tốc độ dịch
  concurrency?: number
  chunkSize?: number
}

export interface ParseResult {
  blocks: DocumentBlock[]
  pageCount: number
  detectedLanguage?: string
  fileType: 'pdf' | 'epub'
}
