import { CAMPAIGN_CONCEPTS_PATH } from '@/lib/campaignIntelligenceConcepts'
import { CAMPAIGN_PROFILE_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { isListPath } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

export const isConceptsPath = (pathname: string): boolean =>
  isListPath(pathname, CAMPAIGN_CONCEPTS_PATH)

export const isProfilePath = (pathname: string): boolean =>
  isListPath(pathname, CAMPAIGN_PROFILE_HOME)

/** B90 — reference/account surfaces with search-only drawer (no action catalog). */
export const isReferenceQuickActionPath = (pathname: string): boolean =>
  isConceptsPath(pathname) || isProfilePath(pathname)

export const resolveReferenceQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []
  if (!isReferenceQuickActionPath(pathname)) return []
  return []
}
