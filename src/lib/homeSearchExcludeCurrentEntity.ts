import { parseAdvisorDetailId } from '@/lib/campaignAdvisorQuickActions'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import { parseMunicipalityDetailSlug } from '@/lib/campaignMunicipalityQuickActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { isDemandDetailPath } from '@/lib/campaignQuickActionDemands'
import {
  parseActivityQuickActionSurface,
  parseOrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'

const leadershipDetailIdFromPath = (pathname: string): number | undefined => {
  const match = pathname.match(/^\/campanha\/liderancas\/(\d+)(?:\/|$)/)
  if (!match?.[1]) return undefined
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : undefined
}

const demandSlugFromPath = (pathname: string): string | undefined => {
  if (!isDemandDetailPath(pathname)) return undefined
  const rest = pathname.slice('/campanha/demandas/'.length)
  return rest || undefined
}

/** Merged pathname + page context for client-side hit exclusion (B109). */
export const resolveHomeSearchExcludeContext = (
  pathname: string,
  context: CampaignQuickActionContext,
): CampaignQuickActionContext => {
  const organizationSurface = parseOrganizationQuickActionSurface(pathname)
  const activitySurface = parseActivityQuickActionSurface(pathname)

  return {
    municipalitySlug: context.municipalitySlug ?? parseMunicipalityDetailSlug(pathname),
    municipalityId: context.municipalityId,
    leadershipId: context.leadershipId ?? leadershipDetailIdFromPath(pathname),
    organizationSlug:
      context.organizationSlug ??
      (organizationSurface?.kind === 'detail' ? organizationSurface.organizationSlug : undefined),
    activitySlug:
      context.activitySlug ??
      (activitySurface?.kind === 'detail' ? activitySurface.activitySlug : undefined),
    demandSlug: context.demandSlug ?? demandSlugFromPath(pathname),
    advisorId: context.advisorId ?? parseAdvisorDetailId(pathname),
  }
}

const hasExcludeTarget = (context: CampaignQuickActionContext): boolean =>
  Boolean(
    context.municipalitySlug ||
    context.leadershipId !== undefined ||
    context.organizationSlug ||
    context.activitySlug ||
    context.demandSlug ||
    context.advisorId !== undefined,
  )

export const filterHomeSearchResponseForContext = (
  data: HomeSearchSuccessResponse,
  context: CampaignQuickActionContext,
): HomeSearchSuccessResponse => {
  if (!hasExcludeTarget(context)) return data

  return {
    ...data,
    municipalities: context.municipalitySlug
      ? data.municipalities.filter((hit) => hit.slug !== context.municipalitySlug)
      : data.municipalities,
    leaderships:
      context.leadershipId !== undefined
        ? data.leaderships.filter((hit) => hit.id !== context.leadershipId)
        : data.leaderships,
    advisors:
      context.advisorId !== undefined
        ? data.advisors.filter((hit) => hit.id !== context.advisorId)
        : data.advisors,
    activities: context.activitySlug
      ? data.activities.filter((hit) => hit.slug !== context.activitySlug)
      : data.activities,
    demands: context.demandSlug
      ? data.demands.filter((hit) => hit.slug !== context.demandSlug)
      : data.demands,
  }
}
