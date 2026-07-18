import { HomeIcon, Layers3Icon, type LucideIcon } from 'lucide-react'

import type { CampaignUser } from '@/payload-types'

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
]

export const getCampaignNav = (role: CampaignUser['role']): CampaignNavItem[] =>
  campaignNav.map((item) =>
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
