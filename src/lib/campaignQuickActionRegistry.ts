import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { resolveStaffHomeQuickActions } from '@/lib/campaignHomeActions'
import { resolveMunicipalityQuickActionsForPath } from '@/lib/campaignMunicipalityQuickActions'
import {
  isDemandDetailPath,
  isDemandsListPath,
  resolveDemandDetailQuickActions,
  resolveDemandsListQuickActions,
} from '@/lib/campaignQuickActionDemands'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import {
  parseActivityQuickActionSurface,
  parseOrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { CAMPAIGN_TERRITORIES_HOME } from '@/lib/campaignPaths'
import type { CampaignRole } from '@/lib/campaignRoles'
import { resolveOrganizationQuickActions } from '@/lib/organizationQuickActions'

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

<<<<<<< HEAD
  const organizationSurface = parseOrganizationQuickActionSurface(pathname)
  if (organizationSurface) {
    return resolveOrganizationQuickActions(organizationSurface, role, context)
=======
  if (isDemandsListPath(pathname)) {
    return resolveDemandsListQuickActions(role)
  }
  if (isDemandDetailPath(pathname)) {
    return resolveDemandDetailQuickActions(role, context)
>>>>>>> 2417ed3 (B85 — Ações rápidas no drawer de Demandas (lista + detalhe))
  }

  const municipalityActions = resolveMunicipalityQuickActionsForPath(pathname, role, context)
  if (municipalityActions.length > 0) return municipalityActions

  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role)
  }
  return []
}
