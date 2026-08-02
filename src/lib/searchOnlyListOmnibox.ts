/**
 * Degenerate omnibox for lists that only expose free-text search (B128:
 * organizações, assessores). Pure / client-safe.
 */
import {
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'

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

export const buildSearchOnlyOmniboxSuggestions = (query: string): CampaignListOmniboxSuggestion[] =>
  filterOmniboxSuggestionSeeds([], query)

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

export const removeSearchOnlyOmniboxChip = <T extends SearchOnlyListState>({
  state,
  chipId,
  withPageReset,
}: {
  state: T
  chipId: string
  withPageReset: (next: T) => T
}): SearchOnlyOmniboxAction<T> => {
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  }
  return { kind: 'url', state }
}

export const clearSearchOnlyOmnibox = <T extends SearchOnlyListState>({
  cleared,
}: {
  state: T
  cleared: T
}): SearchOnlyOmniboxAction<T> => ({
  kind: 'clear',
  state: cleared,
})
