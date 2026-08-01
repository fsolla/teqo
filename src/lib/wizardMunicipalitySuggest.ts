import { engagementLevelRank, type EngagementLevel } from '@/lib/engagementLevel'
import { HOME_SEARCH_SUGGEST_LIMIT } from '@/lib/homeSearchSuggest'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import type { MunicipalityTerritorialClass } from '@/lib/territorialClassAnchors'
import { territorialClassSortWeight } from '@/lib/territorialClassSortWeight'

export type WizardMunicipalitySuggestInput = {
  slug: string
  name: string
  /** ISO timestamp or null when never signaled — colder sorts first. */
  lastSignalAt: string | null
  engagementLevel: EngagementLevel | null
  politicalTrend: PoliticalTrendStatusValue | null
  territorialClass: MunicipalityTerritorialClass
  /** Nominal 2022 candidate votes; null when absent from artifact. */
  votes2022: number | null
}

/** Higher = more urgent for wizard tie-break (desfavorável first). */
const politicalTrendSortWeight: Record<PoliticalTrendStatusValue, number> = {
  desfavoravel: 3,
  neutra: 2,
  favoravel: 1,
}

const municipalityNameCompare = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => left.name.localeCompare(right.name, 'pt-BR')

const compareEngagementLevel = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  const leftRank = left.engagementLevel === null ? -1 : engagementLevelRank[left.engagementLevel]
  const rightRank = right.engagementLevel === null ? -1 : engagementLevelRank[right.engagementLevel]
  if (leftRank !== rightRank) return rightRank - leftRank
  return 0
}

const comparePoliticalTrend = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  const leftWeight =
    left.politicalTrend === null ? 0 : politicalTrendSortWeight[left.politicalTrend]
  const rightWeight =
    right.politicalTrend === null ? 0 : politicalTrendSortWeight[right.politicalTrend]
  if (leftWeight !== rightWeight) return rightWeight - leftWeight
  return 0
}

const compareTerritorialClass = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  const leftWeight = territorialClassSortWeight[left.territorialClass]
  const rightWeight = territorialClassSortWeight[right.territorialClass]
  if (leftWeight === null && rightWeight === null) return 0
  if (leftWeight === null) return 1
  if (rightWeight === null) return -1
  if (leftWeight !== rightWeight) return rightWeight - leftWeight
  return 0
}

const compareVotes2022 = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  const leftVotes = left.votes2022
  const rightVotes = right.votes2022
  if (leftVotes === null && rightVotes === null) return 0
  if (leftVotes === null || leftVotes === 0) return 1
  if (rightVotes === null || rightVotes === 0) return -1
  if (leftVotes !== rightVotes) return rightVotes - leftVotes
  return 0
}

/** Older signal first; null = coldest; equal timestamps defer to later tie-breakers. */
const compareSignalOldestFirst = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  if (left.lastSignalAt === null && right.lastSignalAt === null) return 0
  if (left.lastSignalAt === null) return -1
  if (right.lastSignalAt === null) return 1
  const byTime = left.lastSignalAt.localeCompare(right.lastSignalAt)
  if (byTime !== 0) return byTime
  return 0
}

const compareWizardMunicipalitySuggest = (
  left: WizardMunicipalitySuggestInput,
  right: WizardMunicipalitySuggestInput,
): number => {
  const bySignal = compareSignalOldestFirst(left, right)
  if (bySignal !== 0) return bySignal

  const byEngagement = compareEngagementLevel(left, right)
  if (byEngagement !== 0) return byEngagement

  const byTrend = comparePoliticalTrend(left, right)
  if (byTrend !== 0) return byTrend

  const byClass = compareTerritorialClass(left, right)
  if (byClass !== 0) return byClass

  const byVotes = compareVotes2022(left, right)
  if (byVotes !== 0) return byVotes

  return municipalityNameCompare(left, right)
}

/**
 * B92 — wizard municipality idle suggestions: coldest signal first, then
 * operational tie-breakers (E14 → trend → E10 class → 2022 votes → name).
 */
export const rankWizardMunicipalitySuggestions = (
  municipalities: WizardMunicipalitySuggestInput[],
  limit = HOME_SEARCH_SUGGEST_LIMIT,
): WizardMunicipalitySuggestInput[] =>
  [...municipalities].sort(compareWizardMunicipalitySuggest).slice(0, limit)
