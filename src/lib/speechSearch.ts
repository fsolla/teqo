/**
 * Pure text normalization for the speech catalog (C153). The segment hook
 * stores `normalizeForSearch(text)` in `speechSegment.searchText` and the
 * search UI (C154) normalizes the query with the SAME function before the
 * `contains` query, so accent/case variants match the trigram index.
 */

/** NFD-strips accents, lowercases and collapses whitespace. */
export const normalizeForSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

type SpeechSearchableRecord = {
  /** Normalized segment text persisted by the segment hook (C153). */
  searchText?: string | null
  keywords?: readonly string[] | null
}

/**
 * C180 — pure mirror of a SINGLE textual `where` branch
 * (`speechListFilters.buildSpeechTextBranches`): normalized `searchText` LIKE
 * the normalized term, OR a raw official keyword containing the term.
 * `keywords` compare case-insensitively (accent still significant) to match the
 * ILIKE `%term%` Postgres runs. Adding or removing a branch there means
 * changing this predicate and its test in the same commit. An empty term never
 * matches (a branch with no term cannot surface a row).
 */
export const speechMatchesSearchTerm = (
  speech: SpeechSearchableRecord,
  term: string | undefined,
): boolean => {
  const trimmed = term?.trim()
  if (!trimmed) return false
  if (normalizeForSearch(speech.searchText ?? '').includes(normalizeForSearch(trimmed))) return true
  const lowered = trimmed.toLowerCase()
  return (speech.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(lowered))
}

/**
 * C180 — the search query mirror: empty/missing query is an unconditional match
 * (no textual filter), otherwise any of its terms. C192 reuses
 * `speechMatchesSearchTerm` for the expanded theme terms.
 */
export const speechMatchesSearchQuery = (
  speech: SpeechSearchableRecord,
  query: string | undefined,
): boolean => {
  const trimmed = query?.trim()
  if (!trimmed) return true
  return speechMatchesSearchTerm(speech, trimmed)
}

/**
 * Dedupes values by their normalized form, preserving the first spelling.
 * Used by the facet classifier before persisting people/program mentions.
 */
export const uniqueByNormalizedForm = (values: readonly string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = normalizeForSearch(value)
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    result.push(value.trim())
  }
  return result
}
