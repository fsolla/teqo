/** Debounce for Início omnibox — shorter than list search (1000 ms RSC round-trips). */
export const HOME_SEARCH_DEBOUNCE_MS = 250

/** Minimum trimmed length before focused mode and result providers run. */
const HOME_SEARCH_MIN_QUERY_LENGTH = 2

export type HomeSearchQuery = {
  raw: string
  debounced: string
  isActive: boolean
}

export const homeSearchQueryIsActive = (trimmedDebounced: string): boolean =>
  trimmedDebounced.length >= HOME_SEARCH_MIN_QUERY_LENGTH

export const normalizeHomeSearchRaw = (raw: string): string => raw.trim()
