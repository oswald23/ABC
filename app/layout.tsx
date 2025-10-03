import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Confident Mind Coach (Web)',
  description: 'Daily confidence trainer based on The Confident Mind',
  manifest: '/manifest.json'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-gray-200 dark:border-gray-800">
          <nav className="container py-3 flex gap-3 flex-wrap">
            <Link className="btn" href="/">Dashboard</Link>
            <Link className="btn" href="/project">Project</Link>
            <Link className="btn" href="/coach">Coach</Link>
            <Link className="btn" href="/plan">Action Plan</Link>
            <Link className="btn" href="/reminders">Reminders</Link>
          </nav>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="container py-10 text-sm text-gray-500">PWA: add to home screen; data stored locally in your browser.</footer>
        <script src="/sw-register.js" async></script>
      </body>
    </html>
  )
}
