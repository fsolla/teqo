import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'

/** v1 cap — constant per breakpoint (B54); revisit with ResizeObserver if critique finds blind cuts. */
export const HOME_SEARCH_HIT_BUDGET = {
  mobile: 8,
  tablet: 12,
  desktop: 15,
} as const

export type HomeSearchViewportTier = keyof typeof HOME_SEARCH_HIT_BUDGET

export type HomeSearchGroupId =
  | 'municipalities'
  | 'leaderships'
  | 'advisors'
  | 'activities'
  | 'stateDeputies'
  | 'demands'

const HOME_SEARCH_GROUP_ORDER: readonly HomeSearchGroupId[] = [
  'municipalities',
  'leaderships',
  'advisors',
  'activities',
  'stateDeputies',
  'demands',
]

export type HomeSearchGroupHitCounts = Record<HomeSearchGroupId, number>

export type HomeSearchGroupHitLimits = Record<HomeSearchGroupId, number>

const zeroLimits = (): HomeSearchGroupHitLimits =>
  Object.fromEntries(HOME_SEARCH_GROUP_ORDER.map((id) => [id, 0])) as HomeSearchGroupHitLimits

export const homeSearchHitBudgetForTier = (tier: HomeSearchViewportTier): number =>
  HOME_SEARCH_HIT_BUDGET[tier]

export const buildHomeSearchGroupHitCounts = (
  data: HomeSearchSuccessResponse,
): HomeSearchGroupHitCounts => ({
  municipalities:
    data.municipalities.length + (data.resultKind === 'search' ? data.territories.length : 0),
  leaderships: data.leaderships.length,
  advisors: data.advisors.length,
  activities: data.activities.length,
  stateDeputies: data.stateDeputies.length,
  demands: data.demands.length,
})

/**
 * Municípios consume the budget first; remaining slots fill secondary groups in
 * display order (not round-robin — B54).
 */
export const allocateHitBudget = (
  counts: HomeSearchGroupHitCounts,
  budget: number,
): HomeSearchGroupHitLimits => {
  const limits = zeroLimits()
  if (budget <= 0) return limits

  let remaining = budget

  const municipalitySlots = Math.min(counts.municipalities, remaining)
  limits.municipalities = municipalitySlots
  remaining -= municipalitySlots

  for (const id of HOME_SEARCH_GROUP_ORDER) {
    if (id === 'municipalities' || remaining <= 0) continue
    const groupHits = counts[id]
    if (groupHits <= 0) continue
    const slots = Math.min(groupHits, remaining)
    limits[id] = slots
    remaining -= slots
  }

  return limits
}

export const sliceHomeSearchHits = <T>(hits: readonly T[], limit: number | undefined): T[] =>
  limit === undefined ? [...hits] : hits.slice(0, limit)

export const sliceHomeSearchMunicipalityGroup = (
  municipalities: HomeSearchSuccessResponse['municipalities'],
  territories: HomeSearchSuccessResponse['territories'],
  limit: number | undefined,
  includeTerritories: boolean,
): {
  municipalities: HomeSearchSuccessResponse['municipalities']
  territories: HomeSearchSuccessResponse['territories']
} => {
  if (limit === undefined) {
    return {
      municipalities: [...municipalities],
      territories: includeTerritories ? [...territories] : [],
    }
  }

  const visibleMunicipalities = municipalities.slice(0, limit)
  const remaining = limit - visibleMunicipalities.length
  const visibleTerritories =
    includeTerritories && remaining > 0 ? territories.slice(0, remaining) : []

  return { municipalities: visibleMunicipalities, territories: visibleTerritories }
}
