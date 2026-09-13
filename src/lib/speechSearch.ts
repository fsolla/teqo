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
