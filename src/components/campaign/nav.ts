import {
  CalendarDaysIcon,
  HandshakeIcon,
  HomeIcon,
  InboxIcon,
  MapPinIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import type { CampaignUser } from '@/payload-types'
import { canAccessSupporterArea } from '@/utilities/supporterUi'

export type CampaignNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

const staffNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Praças', href: '/campanha/pracas', icon: MapPinIcon },
  { title: 'Lideranças', href: '/campanha/liderancas', icon: HandshakeIcon },
  { title: 'Planos', href: '/campanha/planos', icon: CalendarDaysIcon },
  { title: 'Demandas', href: '/campanha/demandas', icon: InboxIcon },
  { title: 'Apoiadores', href: '/campanha/apoiadores', icon: UsersIcon },
]

const leaderNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Minhas Praças', href: '/campanha/pracas', icon: MapPinIcon },
  { title: 'Planos', href: '/campanha/planos', icon: CalendarDaysIcon },
  { title: 'Demandas', href: '/campanha/demandas', icon: InboxIcon },
]

export const getCampaignNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  if (role === 'leader') return leaderNav

  return staffNav.filter(
    (item) => item.href !== '/campanha/apoiadores' || canAccessSupporterArea(role),
  )
}

/**
 * Compact set for the mobile bottom bar (max 5 items with a home slot);
 * organizações fica acessível pela sidebar e pelas fichas.
 */
export const getCampaignBottomNav = (role: CampaignUser['role']): CampaignNavItem[] =>
  getCampaignNav(role).filter((item) => item.href !== '/campanha/apoiadores')

/** Home matches only exactly; other items also match nested paths. */
export const isCampaignNavActive = (pathname: string, href: string): boolean => {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
