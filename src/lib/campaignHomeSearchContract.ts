/** Debounce for Início omnibox — shorter than list search (1000 ms RSC round-trips). */
export const HOME_SEARCH_DEBOUNCE_MS = 250

/** Minimum trimmed length before focused mode and result providers run. */
export const HOME_SEARCH_MIN_QUERY_LENGTH = 2

/** Cap for capped home-search entity groups (leadership, dobradinhas). */
export const HOME_SEARCH_RESULT_HIT_CAP = 25

export type HomeSearchQuery = {
  raw: string
  debounced: string
  isActive: boolean
}

export const homeSearchQueryIsActive = (trimmedDebounced: string): boolean =>
  trimmedDebounced.length >= HOME_SEARCH_MIN_QUERY_LENGTH

export const normalizeHomeSearchRaw = (raw: string): string => raw.trim()

/**
 * B66/B68 — focused chrome vs active search query. Fetch uses `isActive`;
 * layout hiding uses `uiFocused` (input focused or query active).
 */
export const homeSearchUiFocused = (input: { inputFocused: boolean; isActive: boolean }): boolean =>
  input.inputFocused || input.isActive
