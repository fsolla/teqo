import {
  BookOpenIcon,
  CalendarDaysIcon,
  HandshakeIcon,
  HomeIcon,
  InboxIcon,
  MapPinIcon,
  UserCogIcon,
  Users2Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser } from '@/payload-types'
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
  { title: 'Assessores', href: '/campanha/assessores', icon: UserCogIcon },
]

/**
 * Reference material, not a place to work: sits in its own group at the foot
 * of the sidebar, below the destinations, and never in the mobile bottom bar.
 * Staff-only — every documented number is one a `leader` never sees.
 *
 * The href is a literal, not an import from `campaignIntelligenceConcepts.ts`:
 * this module reaches client components (`CampaignSidebar`), and that one
 * carries the full glossary content — pulling it in for a single path string
 * would put the whole glossary in the client bundle.
 */
const staffSecondaryNav: CampaignNavItem[] = [
  { title: 'Conceitos', href: '/campanha/conceitos', icon: BookOpenIcon },
]

const leaderNav: CampaignNavItem[] = [
  // The leader home IS the contact tool — one entry, one href (duplicate
  // hrefs previously produced duplicate React keys in the sidebar).
  { title: 'Meus contatos', href: '/campanha', icon: UsersIcon },
]

export const getCampaignNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  if (role === 'leader') return leaderNav

  return staffNav.filter((item) => {
    if (item.href === '/campanha/apoiadores') return canAccessSupporterArea(role)
    if (item.href === '/campanha/assessores') return isUnrestrictedCampaignRole(role)
    return true
  })
}

export const getCampaignSecondaryNav = (role: CampaignUser['role']): CampaignNavItem[] =>
  isStaffCampaignRole(role) ? staffSecondaryNav : []

/**
 * Compact set for the mobile bottom bar (max 5 items with a home slot).
 * Assessores stays sidebar-only (same as perfil/organizações).
 */
export const getCampaignBottomNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  const nav = getCampaignNav(role)
  if (role === 'leader') return nav

  return nav
    .filter(
      (item) =>
        item.href !== '/campanha/apoiadores' && item.href !== '/campanha/assessores',
    )
    .slice(0, 5)
}

/** Home matches only exactly; other items also match nested paths. */
export const isCampaignNavActive = (pathname: string, href: string): boolean => {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
