// components/Nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Dashboard' },
  { href: '/project', label: 'Project Prep' },
  { href: '/coach', label: 'Coach' },
  { href: '/plan', label: 'Action Plan' },
  { href: '/reminders', label: 'Reminders' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-5xl px-4 py-2 flex gap-2">
        {tabs.map(t => {
          const active = pathname === t.href
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'px-3 py-2 rounded-lg text-sm border',
                active
                  ? 'bg-black text-white border-black'
                  : 'bg-white hover:bg-gray-50'
              ].join(' ')}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
