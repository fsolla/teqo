export const normalizeSearchPhrase = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Both sides already normalized. Callers that filter a fixed list against one
 * query should normalize the query once and cache the labels, instead of paying
 * an NFD pass plus three Unicode-property regexes per candidate.
 */
export const matchesNormalizedAtWordStart = (
  normalizedLabel: string,
  normalizedQuery: string,
): boolean => {
  if (!normalizedQuery) return true
  // `normalizeSearchPhrase` emits exactly `words.join(' ')` — alphanumeric runs,
  // single-spaced, trimmed — so a word starts at position 0 and nowhere but
  // after a space. Splitting the label and re-joining every suffix said the same
  // thing while allocating an array and a string per word, per candidate.
  return (
    normalizedLabel.startsWith(normalizedQuery) || normalizedLabel.includes(` ${normalizedQuery}`)
  )
}

export const matchesAtWordStart = (label: string, query: string): boolean => {
  // Normalizing the query first: an empty one matches everything, and callers
  // filter their whole option list with it every time a picker opens.
  const normalizedQuery = normalizeSearchPhrase(query)
  if (!normalizedQuery) return true
  return matchesNormalizedAtWordStart(normalizeSearchPhrase(label), normalizedQuery)
}
