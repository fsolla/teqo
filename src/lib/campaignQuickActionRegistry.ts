import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { resolveStaffHomeQuickActions } from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { parseActivityQuickActionSurface } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { CAMPAIGN_TERRITORIES_HOME } from '@/lib/campaignPaths'
import type { CampaignRole } from '@/lib/campaignRoles'

const isTerritoriesListPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_TERRITORIES_HOME || pathname.startsWith(`${CAMPAIGN_TERRITORIES_HOME}/`)

/**
 * Pathname + role + page context → contextual quick actions.
 * Catalogs per vertical land in B80–B90; the B79 chassis renders whatever
 * this helper returns.
 */
export const resolveQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  const activitySurface = parseActivityQuickActionSurface(pathname)
  if (activitySurface) {
    return resolveActivityQuickActions(activitySurface, role, context)
  }

  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }

  return []
}
