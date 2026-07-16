import { HomeIcon, type LucideIcon } from 'lucide-react'

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
]

/** Home matches only exactly; other items also match nested paths. */
export function isCampaignNavActive(pathname: string, href: string): boolean {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
