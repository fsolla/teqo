import type { CampaignRole } from '@/lib/campaignRoles'
import { isUnrestrictedCampaignRole } from '@/lib/campaignRoles'

/** Parity with B20 `DASHBOARD_PRIORITY_SAMPLE_LIMIT`. */
export const HOME_SEARCH_SUGGEST_LIMIT = 8

export type HomeSearchSuggestMunicipalityInput = {
  slug: string
  name: string
  region: string
  priority: 'alta' | 'normal' | null
  /** ISO timestamp or null when never signaled — colder sorts first. */
  lastSignalAt: string | null
  /** E9 central deficit sort key; only used for unrestricted roles. */
  centralDeficitSortValue: number | null
}

const municipalityNameCompare = (
  left: HomeSearchSuggestMunicipalityInput,
  right: HomeSearchSuggestMunicipalityInput,
): number => left.name.localeCompare(right.name, 'pt-BR')

/** Older signal first; null = coldest. */
const compareSignalOldestFirst = (
  left: HomeSearchSuggestMunicipalityInput,
  right: HomeSearchSuggestMunicipalityInput,
): number => {
  if (left.lastSignalAt === null && right.lastSignalAt === null) {
    return municipalityNameCompare(left, right)
  }
  if (left.lastSignalAt === null) return -1
  if (right.lastSignalAt === null) return 1
  const byTime = left.lastSignalAt.localeCompare(right.lastSignalAt)
  if (byTime !== 0) return byTime
  return municipalityNameCompare(left, right)
}

const compareUnrestrictedSuggest = (
  left: HomeSearchSuggestMunicipalityInput,
  right: HomeSearchSuggestMunicipalityInput,
): number => {
  const leftValue = left.centralDeficitSortValue
  const rightValue = right.centralDeficitSortValue
  if (leftValue === null && rightValue === null) return compareSignalOldestFirst(left, right)
  if (leftValue === null) return 1
  if (rightValue === null) return -1
  if (leftValue === rightValue) return compareSignalOldestFirst(left, right)
  return rightValue - leftValue
}

const rankAdvisorPortfolio = (
  municipalities: HomeSearchSuggestMunicipalityInput[],
  limit: number,
): HomeSearchSuggestMunicipalityInput[] =>
  [...municipalities].sort(compareSignalOldestFirst).slice(0, limit)

const rankUnrestrictedPriority = (
  municipalities: HomeSearchSuggestMunicipalityInput[],
  limit: number,
): HomeSearchSuggestMunicipalityInput[] =>
  municipalities
    .filter((municipality) => municipality.priority === 'alta')
    .sort(compareUnrestrictedSuggest)
    .slice(0, limit)

/**
 * B68 — curated municipality shortcuts for the Início search empty state.
 * Pure policy pinned in unit tests; server loaders supply scoped inputs.
 */
export const rankHomeSearchSuggestMunicipalities = (
  role: CampaignRole,
  municipalities: HomeSearchSuggestMunicipalityInput[],
  limit = HOME_SEARCH_SUGGEST_LIMIT,
): HomeSearchSuggestMunicipalityInput[] => {
  if (municipalities.length === 0) return []

  if (isUnrestrictedCampaignRole(role)) {
    return rankUnrestrictedPriority(municipalities, limit)
  }

  if (role === 'advisor') {
    return rankAdvisorPortfolio(municipalities, limit)
  }

  return []
}
