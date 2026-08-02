/**
 * Shared omnibox types + query matching for campaign list filter bars (B127).
 * Domain adapters build chips/suggestions; the shared UI only renders them.
 */
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

export type CampaignListOmniboxChip = {
  id: string
  /** Full chip label, e.g. "Busca: Feira" or "Prioritária". */
  label: string
}

export type CampaignListOmniboxSuggestion = {
  id: string
  group: string
  label: string
  /** Extra haystack tokens (dimension keywords) beyond `label`. */
  keywords?: readonly string[]
}

const omniboxQueryMatches = (
  haystack: string,
  needle: string,
  keywords: readonly string[] = [],
): boolean => {
  const normalizedNeedle = normalizeSearchPhrase(needle)
  if (!normalizedNeedle) return true
  if (normalizeSearchPhrase(haystack).includes(normalizedNeedle)) return true
  return keywords.some((keyword) => normalizeSearchPhrase(keyword).includes(normalizedNeedle))
}

export const omniboxGroupMatches = (group: string, needle: string): boolean =>
  omniboxQueryMatches(group, needle)

export const SUGGESTION_CAP_PER_GROUP = 8

export type OmniboxSuggestionSeed = CampaignListOmniboxSuggestion & {
  /** When true, show even with an empty query (dimension shortcuts). */
  emptyQueryVisible?: boolean
  normalizedLabel: string
  normalizedKeywords: readonly string[]
}

export const createOmniboxSuggestionSeed = (
  suggestion: CampaignListOmniboxSuggestion,
  extras?: { emptyQueryVisible?: boolean },
): OmniboxSuggestionSeed => ({
  ...suggestion,
  ...extras,
  normalizedLabel: normalizeSearchPhrase(suggestion.label),
  normalizedKeywords: (suggestion.keywords ?? []).map((keyword) => normalizeSearchPhrase(keyword)),
})

export const filterOmniboxSuggestionSeeds = (
  seeds: readonly OmniboxSuggestionSeed[],
  query: string,
): CampaignListOmniboxSuggestion[] => {
  const suggestions: CampaignListOmniboxSuggestion[] = []
  const trimmed = query.trim()
  const normalizedNeedle = normalizeSearchPhrase(trimmed)

  if (trimmed) {
    suggestions.push({
      id: `q:${trimmed}`,
      group: 'Busca',
      label: `Busca: ${trimmed}`,
      keywords: ['busca', 'pesquisar', 'texto'],
    })
  }

  const groupCounts = new Map<string, number>()

  for (const seed of seeds) {
    const count = groupCounts.get(seed.group) ?? 0
    if (count >= SUGGESTION_CAP_PER_GROUP) continue

    if (!normalizedNeedle) {
      if (!seed.emptyQueryVisible) continue
    } else {
      const groupHit = omniboxGroupMatches(seed.group, trimmed)
      const labelHit =
        seed.normalizedLabel.includes(normalizedNeedle) ||
        seed.normalizedKeywords.some((keyword) => keyword.includes(normalizedNeedle))
      if (!groupHit && !labelHit) continue
    }

    const {
      emptyQueryVisible: _visible,
      normalizedLabel: _label,
      normalizedKeywords: _kw,
      ...suggestion
    } = seed
    suggestions.push(suggestion)
    groupCounts.set(seed.group, count + 1)
  }

  return suggestions
}
