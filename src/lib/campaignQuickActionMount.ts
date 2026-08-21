import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import type { AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { isAdvisorsPath } from '@/lib/campaignAdvisorQuickActions'
import { CAMPAIGN_CONTACTS_HOME, CAMPAIGN_HOME, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { isActivityTourComposerPath, isListPath } from '@/lib/campaignQuickActionPaths'
import {
  isStaffCampaignRole,
  isUnrestrictedCampaignRole,
  type CampaignRole,
} from '@/lib/campaignRoles'

/** Same exact-match rule as the sidebar nav. */
export const isCampaignHomePath = (pathname: string): boolean => isListPath(pathname, CAMPAIGN_HOME)

export const isCampaignActionsPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_ACTIONS_HOME || pathname.startsWith(`${CAMPAIGN_ACTIONS_HOME}/`)

export const isLeaderContactsPath = (pathname: string): boolean =>
  pathname === LEADER_CONTACTS_HOME || pathname.startsWith(`${LEADER_CONTACTS_HOME}/`)

/** C139 — the staff contacts page owns a create FAB of its own, so the
 * quick-actions drawer stays out of it. */
export const isContactsPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_CONTACTS_HOME || pathname.startsWith(`${CAMPAIGN_CONTACTS_HOME}/`)

/**
 * Whether the quick-actions FAB should mount on this navigation (all viewports).
 * C142 — advisors with `somente_leitura` never see the FAB on staff surfaces
 * (every action is a write destination).
 */
export const shouldMountQuickActionsFab = (
  pathname: string,
  role: CampaignRole,
  editingScope: AdvisorEditingScope = 'tudo',
): boolean => {
  if (isCampaignHomePath(pathname)) return false
  if (isCampaignActionsPath(pathname)) return false
  // B84: E13 compositor already exposes primary CTAs — skip competing drawer chrome.
  if (isActivityTourComposerPath(pathname)) return false
  if (role === 'leader') return isLeaderContactsPath(pathname)
  if (isContactsPath(pathname)) return false
  if (isAdvisorsPath(pathname)) return isUnrestrictedCampaignRole(role)
  if (!isStaffCampaignRole(role)) return false
  // C142 — `somente_leitura` advisors see no write actions in the drawer.
  return editingScope !== 'none'
}
