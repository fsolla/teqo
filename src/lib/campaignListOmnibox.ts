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

/** Substring match after accent-fold / pt-BR lowercasing. Empty needle matches all. */
export const omniboxQueryMatches = (
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
