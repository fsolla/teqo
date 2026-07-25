export const normalizeSearchPhrase = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const matchesAtWordStart = (label: string, query: string): boolean => {
  const normalizedQuery = normalizeSearchPhrase(query)
  if (!normalizedQuery) return true
  const normalizedLabel = normalizeSearchPhrase(label)
  return normalizedLabel
    .split(/[^\p{Letter}\p{Number}]+/u)
    .some((_, index, words) => words.slice(index).join(' ').startsWith(normalizedQuery))
}
