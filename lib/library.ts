import { DocumentBlock } from './types'

export interface BookMetadata {
  id: string
  title: string
  fileType: 'pdf' | 'epub'
  isFavorite: boolean
  lastPage: number
  totalPages: number
  translatedCount: number
  lastReadAt: number
  createdAt: number
}

const DB_NAME = 'BilingualReaderDB'
const DB_VERSION = 1

// Hàm khởi tạo kết nối tới IndexedDB (chạy ở Client-side)
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB không khả dụng ở Server-side'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Không thể khởi tạo IndexedDB'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = request.result
      
      // Tạo store lưu trữ thông tin tóm tắt của sách (Metadata) để load danh mục siêu nhanh
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' })
      }
      
      // Tạo store lưu trữ chi tiết nội dung các đoạn/câu dịch (Blocks) của sách
      if (!db.objectStoreNames.contains('bookBlocks')) {
        db.createObjectStore('bookBlocks', { keyPath: 'id' })
      }
    }
  })
}

// Lưu cuốn sách mới vào Thư viện (cả Metadata và Blocks nội dung)
export async function saveBookToLibrary(
  metadata: Omit<BookMetadata, 'createdAt' | 'lastReadAt'>,
  blocks: DocumentBlock[]
): Promise<void> {
  const db = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books', 'bookBlocks'], 'readwrite')
    
    transaction.onerror = () => {
      reject(new Error('Lỗi lưu sách vào thư viện'))
    }
    
    transaction.oncomplete = () => {
      resolve()
    }
    
    const booksStore = transaction.objectStore('books')
    const blocksStore = transaction.objectStore('bookBlocks')
    
    const fullMetadata: BookMetadata = {
      ...metadata,
      createdAt: Date.now(),
      lastReadAt: Date.now(),
    }
    
    booksStore.put(fullMetadata)
    blocksStore.put({ id: metadata.id, blocks })
  })
}

// Lấy danh sách toàn bộ sách trong Thư viện (chỉ lấy metadata để cực kỳ nhanh)
export async function getLibraryBooks(): Promise<BookMetadata[]> {
  try {
    const db = await initDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['books'], 'readonly')
      const store = transaction.objectStore('books')
      const request = store.getAll()
      
      request.onerror = () => {
        reject(new Error('Không thể tải danh sách sách'))
      }
      
      request.onsuccess = () => {
        const result = request.result as BookMetadata[]
        // Sắp xếp theo thứ tự đọc gần đây nhất giảm dần
        result.sort((a, b) => b.lastReadAt - a.lastReadAt)
        resolve(result)
      }
    })
  } catch (err) {
    console.error('IndexedDB error:', err)
    return []
  }
}

// Lấy nội dung chi tiết (Blocks) của một cuốn sách khi mở đọc
export async function getBookBlocks(id: string): Promise<DocumentBlock[]> {
  const db = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['bookBlocks'], 'readonly')
    const store = transaction.objectStore('bookBlocks')
    const request = store.get(id)
    
    request.onerror = () => {
      reject(new Error('Không thể tải nội dung sách'))
    }
    
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blocks as DocumentBlock[])
      } else {
        reject(new Error('Không tìm thấy nội dung sách trong thư viện'))
      }
    }
  })
}

// Cập nhật tiến trình đang đọc dở (Trang số mấy)
export async function updateReadingProgress(id: string, page: number): Promise<void> {
  const db = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readwrite')
    const store = transaction.objectStore('books')
    const request = store.get(id)
    
    request.onerror = () => {
      reject(new Error('Lỗi tìm kiếm sách để cập nhật tiến trình'))
    }
    
    request.onsuccess = () => {
      const metadata = request.result as BookMetadata | undefined
      if (metadata) {
        metadata.lastPage = page
        metadata.lastReadAt = Date.now()
        store.put(metadata)
        resolve()
      } else {
        reject(new Error('Không tìm thấy sách cần cập nhật'))
      }
    }
  })
}

// Đánh dấu / Hủy đánh dấu Yêu thích cuốn sách
export async function toggleFavorite(id: string): Promise<boolean> {
  const db = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books'], 'readwrite')
    const store = transaction.objectStore('books')
    const request = store.get(id)
    
    request.onerror = () => {
      reject(new Error('Lỗi tìm kiếm sách để thay đổi trạng thái yêu thích'))
    }
    
    request.onsuccess = () => {
      const metadata = request.result as BookMetadata | undefined
      if (metadata) {
        metadata.isFavorite = !metadata.isFavorite
        store.put(metadata)
        resolve(metadata.isFavorite)
      } else {
        reject(new Error('Không tìm thấy sách'))
      }
    }
  })
}

// Xóa cuốn sách khỏi Thư viện (cả Metadata và Blocks nội dung)
export async function deleteBookFromLibrary(id: string): Promise<void> {
  const db = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['books', 'bookBlocks'], 'readwrite')
    
    transaction.onerror = () => {
      reject(new Error('Lỗi xóa sách khỏi thư viện'))
    }
    
    transaction.oncomplete = () => {
      resolve()
    }
    
    const booksStore = transaction.objectStore('books')
    const blocksStore = transaction.objectStore('bookBlocks')
    
    booksStore.delete(id)
    blocksStore.delete(id)
  })
}
