/**
 * Degenerate omnibox for lists that only expose free-text search (B128:
 * organizações). Pure / client-safe.
 */
import { type CampaignListOmniboxChip } from '@/lib/campaignListOmnibox'

export type SearchOnlyListState = {
  q?: string
  page?: number
}

export type SearchOnlyOmniboxAction<T extends SearchOnlyListState> =
  | { kind: 'url'; state: T }
  | { kind: 'clear'; state: T }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

export const buildSearchOnlyOmniboxChips = (
  state: SearchOnlyListState,
): CampaignListOmniboxChip[] => (state.q ? [{ id: 'q', label: chipLabel('Busca', state.q) }] : [])

export const applySearchOnlyOmniboxSuggestion = <T extends SearchOnlyListState>({
  state,
  suggestionId,
  withPageReset,
}: {
  state: T
  suggestionId: string
  withPageReset: (next: T) => T
}): SearchOnlyOmniboxAction<T> => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }
  return { kind: 'url', state }
}
