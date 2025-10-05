// components/Nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Dashboard' },
  { href: '/project', label: 'Project' },
  { href: '/coach', label: 'Coach' },
  { href: '/plan', label: 'Action Plan' },
  { href: '/reminders', label: 'Reminders' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <nav className="container py-3 flex gap-3 flex-wrap">
        {tabs.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'btn',                               // your existing button base class
                'border',                            // ensure visible boundary
                active
                  ? 'bg-black text-white border-black'
                  : 'bg-white hover:bg-gray-50 border-gray-200 dark:border-gray-700',
              ].join(' ')}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
