import {
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ContactIcon,
  ContactRoundIcon,
  EllipsisVerticalIcon,
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

import {
  CAMPAIGN_AGENDA_HOME,
  CAMPAIGN_CONTACTS_HOME,
  CAMPAIGN_UPDATES_HREF,
  LEADER_CONTACTS_HOME,
} from '@/lib/campaignPaths'
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

/**
 * Named because the sidebar has to recognize this item to hang the C100 saved
 * filters under it — same contract as `MUNICIPALITY_NAV_HREF`.
 */
export const PEOPLE_NAV_HREF = '/campanha/pessoas'

const staffNav: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Quadro', href: '/campanha/quadro', icon: LayoutDashboardIcon },
  { title: 'Municípios', href: MUNICIPALITY_NAV_HREF, icon: MapPinIcon },
  { title: 'Territórios', href: '/campanha/territorios', icon: MapIcon },
  { title: 'Lideranças', href: '/campanha/liderancas', icon: HandshakeIcon },
  { title: 'Organizações', href: '/campanha/organizacoes', icon: LandmarkIcon },
  { title: 'Dobradinhas', href: '/campanha/dobradinhas', icon: Users2Icon },
  { title: 'Pessoas', href: PEOPLE_NAV_HREF, icon: ContactIcon },
  { title: 'Contatos', href: CAMPAIGN_CONTACTS_HOME, icon: ContactRoundIcon },
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
  if (href === CAMPAIGN_UPDATES_HREF) {
    return pathname === CAMPAIGN_UPDATES_HREF || pathname.startsWith(`${CAMPAIGN_UPDATES_HREF}/`)
  }
  if (href === CAMPAIGN_AGENDA_HOME && pathname.startsWith('/campanha/atividades')) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

// The four primary destinations shown in the bottom nav (all except "Mais").
// Used to exclude them from the overflow drawer.
const bottomNavPrimaryHrefs: ReadonlySet<string> = new Set([
  '/campanha',
  MUNICIPALITY_NAV_HREF,
  CAMPAIGN_UPDATES_HREF,
  CAMPAIGN_AGENDA_HOME,
])

/** The five staff items in the mobile bottom nav — Início, Municípios,
 * Atualizações, Agenda, Mais. Leaders get nothing (lockdown). */
const bottomNavStaff: CampaignNavItem[] = [
  { title: 'Início', href: '/campanha', icon: HomeIcon },
  { title: 'Municípios', href: MUNICIPALITY_NAV_HREF, icon: MapPinIcon },
  { title: 'Atualizações', href: CAMPAIGN_UPDATES_HREF, icon: BellIcon },
  { title: 'Agenda', href: CAMPAIGN_AGENDA_HOME, icon: CalendarDaysIcon },
  { title: 'Mais', href: '', icon: EllipsisVerticalIcon },
]

/** Primary navigation for the mobile bottom bar. Staff only — leaders are
 * in lockdown and use the sidebar Sheet (Meus contatos) instead. */
export const getCampaignBottomNav = (role: CampaignUser['role']): CampaignNavItem[] =>
  isStaffCampaignRole(role) ? bottomNavStaff : []

/** Overflow destinations for the "Mais" drawer — staff nav items that are
 * not in the bottom nav's four primaries, plus Conceitos. Perfil and Sair
 * are rendered inline in the drawer footer (same as sidebar). */
export const getCampaignOverflowNav = (role: CampaignUser['role']): CampaignNavItem[] => {
  if (!isStaffCampaignRole(role)) return []
  const primary = getCampaignNav(role).filter((item) => !bottomNavPrimaryHrefs.has(item.href))
  return [...primary, ...getCampaignSecondaryNav(role)]
}
