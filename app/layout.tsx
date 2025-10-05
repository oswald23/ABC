import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// simple helper to style active nav link (client)
function Nav() {
  const pathname = usePathname()
  const link = (href: string, label: string) => (
    <Link
      key={href}
      className={[
        'btn',
        pathname === href ? 'bg-black text-white' : ''
      ].join(' ')}
      href={href}
    >
      {label}
    </Link>
  )
  return (
    <nav className="container py-3 flex gap-3 flex-wrap">
      {link('/', 'Dashboard')}
      {link('/project', 'Project')}
      {link('/coach', 'Coach')}
      {link('/plan', 'Action Plan')}
      {link('/reminders', 'Reminders')}
    </nav>
  )
}

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
          {/* Active link highlighting */}
          {/* @ts-expect-error Server Components can render client child */}
          <Nav />
        </header>

        <main className="container py-6">{children}</main>

        <footer className="container py-10 text-sm text-gray-500">
          Build tag: <b>SplitDeposits-v2</b> — Data stored locally in your browser.
        </footer>

        {/* NOTE: service worker disabled during development to avoid stale caches */}
        {/* <script src="/sw-register.js" async></script> */}
      </body>
    </html>
  )
}
