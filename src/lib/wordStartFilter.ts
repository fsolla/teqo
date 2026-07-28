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
  return normalizedLabel
    .split(/[^\p{Letter}\p{Number}]+/u)
    .some((_, index, words) => words.slice(index).join(' ').startsWith(normalizedQuery))
}

export const matchesAtWordStart = (label: string, query: string): boolean =>
  matchesNormalizedAtWordStart(normalizeSearchPhrase(label), normalizeSearchPhrase(query))
