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

/** Only the non-default orders are meaningful; anything else (and `recentes`) is the default. */
export const parseAcervoSort = (raw: string | string[] | undefined): AcervoSortKey | undefined => {
  const value = firstParam(raw)
  return value && value !== 'recentes' && ACERVO_SORT_SET.has(value)
    ? (value as AcervoSortKey)
    : undefined
}

/** Duration orders only make sense over rows with a measured duration. */
export const acervoSortIsDuration = (sort: AcervoSortKey | undefined): boolean =>
  sort === 'duracao_maior' || sort === 'duracao_menor'
