import { CalendarDaysIcon, HomeIcon, Layers3Icon, UsersIcon, type LucideIcon } from 'lucide-react'

import type { CampaignUser } from '@/payload-types'
import { canAccessSupporterArea } from '@/utilities/supporterUi'

export type CampaignNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const campaignNav: CampaignNavItem[] = [
  {
    title: 'Início',
    href: '/campanha',
    icon: HomeIcon,
  },
  {
    title: 'Núcleos',
    href: '/campanha/nucleos',
    icon: Layers3Icon,
  },
  {
    title: 'Planos',
    href: '/campanha/planos',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Apoiadores',
    href: '/campanha/apoiadores',
    icon: UsersIcon,
  },
]

export const getCampaignNav = (role: CampaignUser['role']): CampaignNavItem[] =>
  campaignNav
    .filter((item) => item.href !== '/campanha/apoiadores' || canAccessSupporterArea(role))
    .map((item) =>
      item.href === '/campanha/nucleos' && role === 'lideranca'
        ? { ...item, title: 'Meus núcleos' }
        : item,
    )

/** Home matches only exactly; other items also match nested paths. */
export const isCampaignNavActive = (pathname: string, href: string): boolean => {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
