import {
  CalendarDaysIcon,
  HandshakeIcon,
  HomeIcon,
  InboxIcon,
  MapPinIcon,
  Users2Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { canAccessSupporterArea } from '@/utilities/supporterUi'

export type CampaignNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

const staffNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Municípios', href: '/campanha/municipios', icon: MapPinIcon },
  { title: 'Lideranças', href: '/campanha/liderancas', icon: HandshakeIcon },
  { title: 'Dobradinhas', href: '/campanha/dobradinhas', icon: Users2Icon },
  { title: 'Planos', href: '/campanha/planos', icon: CalendarDaysIcon },
  { title: 'Demandas', href: '/campanha/demandas', icon: InboxIcon },
  { title: 'Apoiadores', href: '/campanha/apoiadores', icon: UsersIcon },
]

const leaderNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Meus contatos', href: '/campanha', icon: UsersIcon },
]

export const getCampaignNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  if (role === 'leader') return leaderNav

  return staffNav.filter(
    (item) => item.href !== '/campanha/apoiadores' || canAccessSupporterArea(role),
  )
}

/**
 * Compact set for the mobile bottom bar (max 5 items with a home slot).
 */
export const getCampaignBottomNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  const nav = getCampaignNav(role)
  if (role === 'leader') return nav

  return nav.filter((item) => item.href !== '/campanha/apoiadores').slice(0, 5)
}

/** Home matches only exactly; other items also match nested paths. */
export const isCampaignNavActive = (pathname: string, href: string): boolean => {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export const isCampaignStaffRole = (role: CampaignUser['role']): boolean =>
  isCampaignStaff({ collection: 'campaignUser', role } as CampaignUser)
