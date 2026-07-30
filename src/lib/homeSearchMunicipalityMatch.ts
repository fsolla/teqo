import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

/** Lower tier = stronger name match (word-start at label start beats mid-label). */
export const homeSearchNameRelevanceTier = (
  normalizedLabel: string,
  normalizedQuery: string,
): number => {
  if (!normalizedQuery) return 0
  if (normalizedLabel.startsWith(normalizedQuery)) return 0
  if (normalizedLabel.includes(` ${normalizedQuery}`)) return 1
  return 2
}

export type HomeSearchNameSortable = {
  normalizedName: string
  /** Secondary sort key (higher sorts first after name relevance tier). */
  tieBreakDesc: number
}

export const compareHomeSearchNameRelevance = (
  left: HomeSearchNameSortable,
  right: HomeSearchNameSortable,
  normalizedQuery: string,
): number => {
  const tierDelta =
    homeSearchNameRelevanceTier(left.normalizedName, normalizedQuery) -
    homeSearchNameRelevanceTier(right.normalizedName, normalizedQuery)
  if (tierDelta !== 0) return tierDelta
  return right.tieBreakDesc - left.tieBreakDesc
}

export const normalizeHomeSearchName = (name: string): string => normalizeSearchPhrase(name)
