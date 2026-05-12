import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dịch Tài Liệu EPUB / PDF',
  description: 'Dịch tài liệu sang tiếng Việt, giữ nguyên layout',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">{children}</body>
    </html>
  )
}
