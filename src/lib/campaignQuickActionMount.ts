import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

/** Início matches only exactly — same rule as sidebar nav. */
export const isCampaignHomePath = (pathname: string): boolean =>
  pathname === CAMPAIGN_HOME || pathname === `${CAMPAIGN_HOME}/`

export const isCampaignActionsPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_ACTIONS_HOME || pathname.startsWith(`${CAMPAIGN_ACTIONS_HOME}/`)

export const isLeaderContactsPath = (pathname: string): boolean =>
  pathname === LEADER_CONTACTS_HOME || pathname.startsWith(`${LEADER_CONTACTS_HOME}/`)

/**
 * Whether the mobile quick-actions drawer should mount on this navigation.
 * Desktop (`md+`) is gated in the host via `useIsMobile`.
 */
export const shouldMountQuickActionsDrawer = (pathname: string, role: CampaignRole): boolean => {
  if (isCampaignHomePath(pathname)) return false
  if (isCampaignActionsPath(pathname)) return false
  if (role === 'leader') return isLeaderContactsPath(pathname)
  return isStaffCampaignRole(role)
}
