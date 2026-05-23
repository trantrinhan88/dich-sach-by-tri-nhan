# Project Plan: Next.js Bilingual EPUB Translator & Language Learning App

Dự án phát triển ứng dụng Web bằng Next.js hỗ trợ người dùng tải lên sách ngoại ngữ định dạng `.epub`, tự động phân tách câu, dịch song ngữ bằng API Gemini (tối ưu hóa chi phí với Gemini 2.5 Flash + Context Caching) và xuất ra file sách song ngữ thành phẩm để nạp vào các thiết bị đọc sách (Kindle, Kobo, Máy tính bảng).

---

## 📅 Giai Đoạn 1: Thiết Kế Kiến Trúc & Xử Lý File (Tuần 1)

Mục tiêu chính là xây dựng luồng Upload, giải mã file EPUB và chuẩn bị cấu trúc dữ liệu thô.

### 1.1 Quản lý Upload & Giải mã EPUB (Backend - API Routes)
- [ ] Thiết lập API Endpoint `POST /api/epub/upload` nhận file `.epub`.
- [ ] Sử dụng các thư viện Node.js (`epub-parser` hoặc giải nén Zip thủ công) để truy cập thư mục gốc và trích xuất nội dung từ các file `.xhtml` / `.html` (các chương sách).
- [ ] Xây dựng giải pháp bóc tách sạch (Sanitize): Chỉ lấy thẻ văn bản (`<p>`, `<h1>`, `<h2>`), loại bỏ các thẻ script hoặc style rác nhưng giữ lại các class bố cục quan trọng.

### 1.2 Phân tách câu (Sentence Tokenization)
- [ ] Tích hợp thư viện `sentence-splitter` trong môi trường Node.js.
- [ ] Quét qua toàn bộ nội dung text của từng chương, tách các thẻ `<p>` thành mảng các câu độc lập dựa trên dấu câu hệ thống bản địa (`.`, `?`, `!`).
- [ ] Định dạng cấu trúc dữ liệu thô dạng JSON chuẩn trước khi dịch:
```json
  {
    "chapter_id": "chapter-1",
    "sentences": [
      { "id": 1, "en": "Call me Ishmael." },
      { "id": 2, "en": "Some years ago—never mind how long precisely..." }
    ]
  }
  ⚡ Giai Đoạn 2: Tích Hợp AI & Chiến Lược Tối Ưu Chi Phí (Tuần 2)
Mục tiêu cốt lõi: Sử dụng dòng mô hình Gemini 2.5 Flash để dịch toàn bộ cuốn sách 500 trang với chi phí tiệm cận 0 đồng nhờ kỹ thuật Caching.

2.1 Cấu hình Hệ thống Context Caching
[ ] Tích hợp SDK chính thức @google/genai.

[ ] Khởi tạo Cache (POST /api/translate/cache): Gửi toàn bộ Text thô của cuốn sách lên vùng đệm của Google AI Studio thông qua ai.caches.create. Đặt thời gian sống ttl là 3600s (1 tiếng) để AI ghi nhớ mạch truyện, tên nhân vật, bối cảnh. Lưu lại cacheName nhận được.

2.2 Gom Cụm Xử Lý (Batching Pipeline) và Gọi Dịch
[ ] Chia nhỏ mảng câu thành từng Block (Chunk) từ 50 đến 100 câu (~2000 - 3000 từ) để tránh lỗi nghẽn hoặc vượt quá giới hạn token đầu ra một lần gửi.

[ ] Gọi dịch thuật kết hợp Caching (POST /api/translate/process): Gửi chunk kèm tham số cachedContent: cacheName. Hệ thống tự động ánh xạ vào bộ nhớ đệm giúp giảm 90% chi phí Input Token (chỉ còn $0.03/1M tokens).

[ ] Sử dụng tính năng Structured Outputs cố định để ép Gemini phản hồi chính xác JSON mong muốn bằng responseSchema:

TypeScript
  responseSchema: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        en: { type: Type.STRING },
        vi: { type: Type.STRING }
      },
      required: ['id', 'en', 'vi']
    }
  }
2.3 Cơ chế Chống nghẽn & Bảo vệ Dữ liệu (Guardrails)
[ ] Hãm tốc độ (Rate Limiting Sleep): Cài đặt hàm trễ chủ động setTimeout nghỉ từ 4 - 5 giây ở Client-side Next.js giữa mỗi lượt gọi API gửi Chunk để không dính lỗi 429 Too Many Requests (Đặc biệt hiệu quả khi dùng Bản Free Tier với 15 requests/phút).

[ ] Kiểm tra khớp dòng (Data Alignment Check): Viết logic kiểm tra:

TypeScript
  if (inputChunk.length !== outputChunk.length) {
    // Trợ lý tự động kích hoạt dịch lại nhóm câu lỗi (Retry mechanism)
  }
🎨 Giai Đoạn 3: Đóng Gói Sách & Thiết Kế Giao Diện Đọc Sách (Tuần 3)
Mục tiêu: Đưa dữ liệu song ngữ từ bộ nhớ vào cấu trúc EPUB mới và định dạng giao diện hiển thị chuyên nghiệp.

3.1 Định dạng Sách Song Ngữ (Bilingual Layout HTML/CSS)
[ ] Lựa chọn hiển thị mặc định: Dòng đôi (Interlinear) giúp tương thích 100% mọi thiết bị (Kindle, Di động).

[ ] Biên dịch dữ liệu JSON thành các thẻ HTML kèm CSS tùy biến nhúng thẳng vào file EPUB:

CSS
  .bilingual-pair { margin-bottom: 1.6em; line-height: 1.6; }
  .original-text { font-weight: bold; color: #000000; font-size: 1em; display: block; }
  .translated-text { color: #555555; font-size: 0.85em; display: block; margin-top: 6px; font-style: italic; }
3.2 Đóng gói và Xuất File EPUB
[ ] Sử dụng thư viện nodepub hoặc epub-gen-nodejs ở tầng API Route để thu gom toàn bộ HTML của các chương đã được dịch song ngữ.

[ ] Đóng gói lại thành tệp tin .epub tiêu chuẩn (bao gồm metadata: Tên sách + "_Bilingual", Tác giả, Ảnh Cover).

[ ] Trả luồng dữ liệu (Stream file) về Client để kích hoạt tính năng tự động tải về trình duyệt cho người dùng.

🚀 Giai Đoạn 4: Tính Năng Mở Rộng Học Ngoại Ngữ (Hậu MVP)
Các tính năng gia tăng giá trị giúp người dùng học tập trực tiếp, biến sản phẩm thành một ứng dụng EdTech thực thụ.

[ ] Trình đọc sách Web tích hợp (Web Reader): Tích hợp epubjs làm giao diện đọc sách trực tuyến ngay trên App Next.js.

[ ] Tính năng Tương tác Câu: Khi người đọc nhấp vào một câu tiếng Anh, câu tiếng Việt mờ phía dưới sẽ sáng lên rõ ràng, hỗ trợ ép não bộ tự dịch trước khi xem đáp án.

[ ] Sổ tay Từ Vựng (Vocab Flashcards): Cho phép bôi đen một từ/cụm từ bất kỳ khi đọc trên Web, lưu từ đó kèm câu ngữ cảnh vào cơ sở dữ liệu (PostgreSQL/Supabase) để ôn tập theo thuật toán lặp lại ngắt quãng (Spaced Repetition).

[ ] Tùy biến Prompt dịch thuật nâng cao: Cho phép người dùng tùy chọn văn phong dịch trước khi chạy app (Ví dụ: "Dịch thoát ý thơ mộng", "Dịch sát nghĩa học thuật", hoặc "Dịch phù hợp trình độ TOEIC 500").