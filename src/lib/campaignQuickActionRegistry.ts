import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { resolveAdvisorQuickActionsForPath } from '@/lib/campaignAdvisorQuickActions'
import { resolveStaffHomeQuickActions } from '@/lib/campaignHomeActions'
import { resolveMunicipalityQuickActionsForPath } from '@/lib/campaignMunicipalityQuickActions'
import { resolveMunicipalityV2QuickActionsForPath } from '@/lib/campaignMunicipalityV2QuickActions'
import { CAMPAIGN_TERRITORIES_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import {
  isDemandDetailPath,
  isDemandsListPath,
  resolveDemandDetailQuickActions,
  resolveDemandsListQuickActions,
} from '@/lib/campaignQuickActionDemands'
import {
  matchesDobradinhasQuickActionSurface,
  resolveDobradinhasQuickActions,
} from '@/lib/campaignQuickActionDobradinhas'
import { resolveLeadershipQuickActions } from '@/lib/campaignQuickActionLeadership'
import { isLeaderContactsPath } from '@/lib/campaignQuickActionMount'
import {
  parseActivityQuickActionSurface,
  parseOrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import {
  isReferenceQuickActionPath,
  resolveReferenceQuickActionsForPath,
} from '@/lib/campaignReferenceQuickActions'
import type { CampaignRole } from '@/lib/campaignRoles'
import { resolveLeaderContactsQuickActions } from '@/lib/leaderContactsQuickActions'
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
  if (isLeaderContactsPath(pathname)) {
    return resolveLeaderContactsQuickActions(role, context)
  }

  const activitySurface = parseActivityQuickActionSurface(pathname)
  if (activitySurface) {
    return resolveActivityQuickActions(activitySurface, role, context, pathname)
  }

  const organizationSurface = parseOrganizationQuickActionSurface(pathname)
  if (organizationSurface) {
    return resolveOrganizationQuickActions(organizationSurface, role, context)
  }

  if (isDemandsListPath(pathname)) {
    return resolveDemandsListQuickActions(role)
  }
  if (isDemandDetailPath(pathname)) {
    return resolveDemandDetailQuickActions(role, context, pathname)
  }

  const municipalityV2Actions = resolveMunicipalityV2QuickActionsForPath(pathname, role, context)
  if (municipalityV2Actions !== null) return municipalityV2Actions

  const municipalityActions = resolveMunicipalityQuickActionsForPath(pathname, role, context)
  if (municipalityActions.length > 0) return municipalityActions

  const leadershipActions = resolveLeadershipQuickActions(pathname, role, context)
  if (leadershipActions !== null) {
    return leadershipActions
  }

  if (matchesDobradinhasQuickActionSurface(pathname)) {
    return resolveDobradinhasQuickActions(pathname, role)
  }

  const advisorActions = resolveAdvisorQuickActionsForPath(pathname, role, context)
  if (advisorActions.length > 0) return advisorActions

  if (isTerritoriesListPath(pathname)) {
    return resolveStaffHomeQuickActions(role, pathname)
  }

  const referenceActions = resolveReferenceQuickActionsForPath(pathname, role, context)
  if (isReferenceQuickActionPath(pathname)) return referenceActions

  return []
}
