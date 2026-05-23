import { randomUUID } from 'crypto'

export interface VocabItem {
  id: string
  word: string // Từ hoặc cụm từ tiếng Anh
  context: string // Câu ngữ cảnh gốc chứa từ này
  translation: string // Bản dịch tiếng Việt của câu ngữ cảnh
  box: number // Hộp ôn tập từ 1 đến 5
  nextReview: number // Timestamp thời điểm tiếp theo cần ôn tập
  interval: number // Khoảng cách ngày ôn tập tiếp theo
  easeFactor: number // Hệ số dễ học (SM-2, mặc định 2.5)
  createdAt: number // Ngày thêm từ
}

const LS_VOCAB_KEY = 'dich-sach-vocab-notebook'

// Thuật toán SM-2 để tính thời điểm ôn tập tiếp theo dựa trên phản hồi của người học
// score: 1 (quên hoàn toàn) -> 5 (nhớ hoàn hảo)
export function updateSRS(item: VocabItem, score: number): VocabItem {
  let { box, interval, easeFactor } = item

  // Cập nhật hệ số dễ học (easeFactor) dựa trên công thức SM-2
  easeFactor = easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3 // Cận dưới cho ease factor

  if (score < 3) {
    // Nếu quên (score < 3): Quay lại hộp 1 và ôn tập lại sau 1 ngày
    box = 1
    interval = 1
  } else {
    // Nếu nhớ (score >= 3)
    if (box === 1) {
      interval = 1 // Hộp 1: khoảng cách 1 ngày
    } else if (box === 2) {
      interval = 4 // Hộp 2: khoảng cách 4 ngày
    } else {
      interval = Math.round(interval * easeFactor) // Các hộp tiếp theo: tăng theo hệ số easeFactor
    }
    box = Math.min(box + 1, 5) // Tăng hộp nhưng giới hạn tối đa là hộp 5
  }

  // Chuyển khoảng cách ngày thành mili-giây
  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000

  return {
    ...item,
    box,
    interval,
    easeFactor,
    nextReview,
  }
}

// Lấy toàn bộ từ vựng đã lưu trong LocalStorage
export function getVocabItems(): VocabItem[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(LS_VOCAB_KEY)
    return saved ? JSON.parse(saved) : []
  } catch (err) {
    console.error('Lỗi khi đọc từ vựng từ LocalStorage:', err)
    return []
  }
}

// Lưu toàn bộ danh sách từ vựng
export function saveVocabItems(items: VocabItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(items))
  } catch (err) {
    console.error('Lỗi khi ghi từ vựng vào LocalStorage:', err)
  }
}

// Thêm một từ vựng mới vào sổ tay
export function addVocabItem(word: string, context: string, translation: string): VocabItem | null {
  if (!word.trim() || !context.trim()) return null

  const items = getVocabItems()

  // Kiểm tra nếu từ này đã được lưu với ngữ cảnh tương tự để tránh trùng lặp
  const exists = items.some(item => 
    item.word.toLowerCase() === word.toLowerCase().trim() && 
    item.context.toLowerCase() === context.toLowerCase().trim()
  )
  if (exists) return null

  const newItem: VocabItem = {
    id: typeof window !== 'undefined' && window.crypto?.randomUUID 
      ? window.crypto.randomUUID() 
      : Math.random().toString(36).substring(2) + Date.now().toString(36),
    word: word.trim(),
    context: context.trim(),
    translation: translation.trim(),
    box: 1,
    nextReview: Date.now() + 10 * 1000, // Cần ôn tập sau 10 giây (ngay lập tức khi học)
    interval: 0,
    easeFactor: 2.5,
    createdAt: Date.now(),
  }

  items.push(newItem)
  saveVocabItems(items)
  return newItem
}

// Xóa từ vựng
export function deleteVocabItem(id: string): void {
  const items = getVocabItems()
  const filtered = items.filter(item => item.id !== id)
  saveVocabItems(filtered)
}

// Đánh giá từ vựng (chạy thuật toán SRS và cập nhật lịch ôn tập)
export function evaluateVocabItem(id: string, score: number): VocabItem | null {
  const items = getVocabItems()
  const index = items.findIndex(item => item.id === id)
  if (index === -1) return null

  const updatedItem = updateSRS(items[index], score)
  items[index] = updatedItem
  saveVocabItems(items)
  return updatedItem
}
