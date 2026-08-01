import {
  resolveStaffHomeQuickActions,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import { resolveMunicipalityQuickActionsForPath } from '@/lib/campaignMunicipalityQuickActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
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
): readonly ResolvedCampaignHomeAction[] => {
  const municipalityActions = resolveMunicipalityQuickActionsForPath(pathname, role, context)
  if (municipalityActions.length > 0) return municipalityActions

  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }

  return []
}
