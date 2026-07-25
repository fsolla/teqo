'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { getCampaignBottomNav, isCampaignNavActive } from '@/components/campaign/nav'
import { cn } from '@/lib/utils'
import type { CampaignUser } from '@/payload-types'

export const CampaignBottomNav = ({ role }: { role: CampaignUser['role'] }) => {
  const pathname = usePathname()
  const navItems = getCampaignBottomNav(role)

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul
        className="m-0 grid list-none p-0"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const active = isCampaignNavActive(pathname, item.href)

          return (
            <li key={item.href} className="m-0 p-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'text-primary',
                )}
              >
                <item.icon aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
