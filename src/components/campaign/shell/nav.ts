import {
  BookOpenIcon,
  CalendarDaysIcon,
  HandshakeIcon,
  HomeIcon,
  InboxIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MapIcon,
  MapPinIcon,
  UserCogIcon,
  Users2Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'

import { CAMPAIGN_AGENDA_HOME, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser } from '@/payload-types'
import { canAccessSupporterArea } from '@/utilities/supporter/supporterUi'

export type CampaignNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

/**
 * Named because the sidebar has to recognize this one item to hang B18's saved
 * filters under it, and a third spelling that silently no-ops when it drifts is
 * the failure mode this codebase keeps paying for.
 */
export const MUNICIPALITY_NAV_HREF = '/campanha/municipios'

const staffNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Quadro', href: '/campanha/quadro', icon: LayoutDashboardIcon },
  { title: 'Municípios', href: MUNICIPALITY_NAV_HREF, icon: MapPinIcon },
  { title: 'Territórios', href: '/campanha/territorios', icon: MapIcon },
  { title: 'Lideranças', href: '/campanha/liderancas', icon: HandshakeIcon },
  { title: 'Organizações', href: '/campanha/organizacoes', icon: LandmarkIcon },
  { title: 'Dobradinhas', href: '/campanha/dobradinhas', icon: Users2Icon },
  { title: 'Agenda', href: CAMPAIGN_AGENDA_HOME, icon: CalendarDaysIcon },
  { title: 'Demandas', href: '/campanha/demandas', icon: InboxIcon },
  { title: 'Apoiadores', href: '/campanha/apoiadores', icon: UsersIcon },
  { title: 'Assessores', href: '/campanha/assessores', icon: UserCogIcon },
]

/**
 * Reference material, not a place to work: sits in its own group at the foot
 * of the sidebar, below the destinations.
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
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Meus contatos', href: LEADER_CONTACTS_HOME, icon: UsersIcon },
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

/** Home matches only exactly; other items also match nested paths. */
export const isCampaignNavActive = (pathname: string, href: string): boolean => {
  if (href === '/campanha') {
    return pathname === '/campanha' || pathname === '/campanha/'
  }
  if (href === CAMPAIGN_AGENDA_HOME && pathname.startsWith('/campanha/atividades')) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}
