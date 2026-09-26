/**
 * C216 — the ONE ordering vocabulary of the acervo list: the recordings source
 * (C219) and the web speeches source (C216) share the options, the labels, the
 * `recentes` default (never serialized) and the duration gate. Each domain owns
 * the mapping to its Payload order (recordings default `-createdAt`, web
 * `-speechAt`); a duration order only lists rows with a measured duration,
 * because Postgres sorts NULLS FIRST on DESC.
 */

export const ACERVO_SORT_OPTIONS = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'duracao_maior', label: 'Duração (maior)' },
  { value: 'duracao_menor', label: 'Duração (menor)' },
] as const

export type AcervoSortKey = (typeof ACERVO_SORT_OPTIONS)[number]['value']

const ACERVO_SORT_SET = new Set<string>(ACERVO_SORT_OPTIONS.map(({ value }) => value))

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/**
 * Only the non-default orders are meaningful; anything else (and `recentes`) is the default.
 */
export const parseAcervoSort = (raw: string | string[] | undefined): AcervoSortKey | undefined => {
  const value = firstParam(raw)
  return value && value !== 'recentes' && ACERVO_SORT_SET.has(value)
    ? (value as AcervoSortKey)
    : undefined
}

/**
 * C229 — the ordering vocabulary of the theme mode of the speech acervo:
 * relevance is the default (never serialized) and the explicit date/duration
 * order must stay askable. Recordings and the public Central keep
 * `ACERVO_SORT_OPTIONS` — their theme mode is not the semantic engine.
 */
export const ACERVO_THEME_SORT_OPTIONS = [
  { value: 'relevancia', label: 'Mais relevantes' },
  ...ACERVO_SORT_OPTIONS,
] as const

export type AcervoThemeSortKey = (typeof ACERVO_THEME_SORT_OPTIONS)[number]['value']

const ACERVO_THEME_SORT_SET = new Set<string>(ACERVO_THEME_SORT_OPTIONS.map(({ value }) => value))

/**
 * Theme-aware parse: `relevancia` (and anything unknown) parses away as the
 * default, while `recentes` is a REAL state here — the exact-mode default has
 * to stay explicitly askable after relevance became the theme default.
 */
export const parseAcervoThemeSort = (
  raw: string | string[] | undefined,
): AcervoSortKey | undefined => {
  const value = firstParam(raw)
  if (!value || value === 'relevancia' || !ACERVO_THEME_SORT_SET.has(value)) return undefined
  return value as AcervoSortKey
}

/** Duration orders only make sense over rows with a measured duration. */
export const acervoSortIsDuration = (sort: AcervoSortKey | undefined): boolean =>
  sort === 'duracao_maior' || sort === 'duracao_menor'
