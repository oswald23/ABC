// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Confident Mind Coach (Web)',
  description: 'Daily confidence trainer based on The Confident Mind',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container py-6">{children}</main>
        <footer className="container py-10 text-sm text-gray-500">
          PWA: add to home screen; data stored locally in your browser.
        </footer>
        <script src="/sw-register.js" async></script>
      </body>
    </html>
  )
}
