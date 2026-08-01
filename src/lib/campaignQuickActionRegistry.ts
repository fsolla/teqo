import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { resolveStaffHomeQuickActions } from '@/lib/campaignHomeActions'
import { resolveMunicipalityQuickActionsForPath } from '@/lib/campaignMunicipalityQuickActions'
import { parseOrganizationQuickActionSurface } from '@/lib/campaignQuickActionPaths'
import { resolveOrganizationQuickActions } from '@/lib/organizationQuickActions'
import { CAMPAIGN_TERRITORIES_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { parseActivityQuickActionSurface } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
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

  const organizationSurface = parseOrganizationQuickActionSurface(pathname)
  if (organizationSurface) {
    return resolveOrganizationQuickActions(organizationSurface, role, context)
  }

  const municipalityActions = resolveMunicipalityQuickActionsForPath(pathname, role, context)
  if (municipalityActions.length > 0) return municipalityActions

  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }

  return []
}
