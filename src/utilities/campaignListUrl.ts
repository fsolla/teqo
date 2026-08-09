import type { Where } from 'payload'

export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Sentinel for the "Sem partido" filter row — `party` is a free-text optional
 * field (no closed enum to validate a real value against), so this constant
 * is the only reserved token; a dobradinha whose actual party name collided
 * with it would be indistinguishable, an accepted precedent-level risk (the
 * curated field spans a couple dozen Brazilian party acronyms). Lives here so
 * every list that filters municipalities by a dobradinha's party — the
 * dobradinhas list and the municípios list — shares ONE sentinel value.
 */
export const NO_PARTY_FILTER_VALUE = 'sem_partido'

/**
 * Splits a multi-value filter into its named values and whether the "absence"
 * sentinel is selected. Every list filter with a selectable absence (level's
 * "Sem nível", party's "Sem partido", B176's "Sem dobradinha" / "Sem
 * liderança") repeats this pair — extract here instead of a per-list copy.
 */
export const splitAbsenceFilterValues = <Named>(
  values: readonly Named[],
  isAbsence: (value: Named) => boolean,
): { named: Named[]; hasAbsence: boolean } => {
  const named: Named[] = []
  let hasAbsence = false
  for (const value of values) {
    if (isAbsence(value)) hasAbsence = true
    else named.push(value)
  }
  return { named, hasAbsence }
}

/** Collapses 0..n OR branches: none → undefined, one → the branch, many → `{ or }`. */
export const collapseListWhereOrBranches = (branches: readonly Where[]): Where | undefined =>
  branches.length > 1 ? { or: [...branches] } : branches[0]

export const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

/** Flatten a repeated query param into distinct trimmed values. */
export const allParamValues = (value: string | string[] | undefined): string[] => {
  if (value === undefined) return []
  const cells = Array.isArray(value) ? value : [value]
  const seen = new Set<string>()
  for (const cell of cells) {
    const trimmed = cell.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

/**
 * A repeatable enum param where selecting EVERY member means "todas" — which
 * is the same filter as selecting none, and canonicalizes to the absent param
 * so both produce one URL (B18's frozen contract). `allParamValues` already
 * dropped duplicates and unknown tokens are ignored, so a hand-typed URL can
 * never widen the filter.
 */
export const parseExhaustiveEnumParam = <T extends string>(
  raw: string | string[] | undefined,
  allowed: ReadonlySet<string>,
): T[] => {
  const values = allParamValues(raw).filter((token): token is T => allowed.has(token))
  return values.length < allowed.size ? values : []
}

/** "A, B" for ≤2 names, "A, B +N" beyond — the active-filters summary shorthand. */
export const truncatedNamesLabel = (names: readonly string[]): string =>
  names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`

export const normalizedText = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

export const strictDecimalInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

export const inspectRawListParams = (
  params: RawSearchParams,
  paramNameSet: ReadonlySet<string>,
): { hasUnsupportedParams: boolean; query: string } => {
  const serialized = new URLSearchParams()
  let hasUnsupportedParams = false

  for (const [name, value] of Object.entries(params)) {
    if (!paramNameSet.has(name)) {
      hasUnsupportedParams = true
      continue
    }
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      serialized.append(name, item)
    }
  }

  return { hasUnsupportedParams, query: serialized.toString() }
}

export type ListStateWithPage = { page: number }

export type ResolveListUrlOptions<State extends ListStateWithPage> = {
  params: RawSearchParams
  paramNameSet: ReadonlySet<string>
  parse: (params: RawSearchParams) => State
  buildSearchParams: (state: State) => URLSearchParams
  basePath: string
  totalPages?: number
}

export const resolveListUrl = <State extends ListStateWithPage>(
  options: ResolveListUrlOptions<State>,
): {
  state: State
  href: string
  redirectHref?: string
} => {
  const { params, paramNameSet, parse, buildSearchParams, basePath, totalPages } = options
  const parsedState = parse(params)
  const page =
    totalPages !== undefined && totalPages > 0 && parsedState.page > totalPages
      ? totalPages
      : parsedState.page
  const state = page === parsedState.page ? parsedState : ({ ...parsedState, page } as State)
  const canonicalParams = buildSearchParams(state)
  const canonicalQuery = canonicalParams.toString()
  const href = canonicalQuery ? `${basePath}?${canonicalQuery}` : basePath
  const raw = inspectRawListParams(params, paramNameSet)
  const needsRedirect = raw.hasUnsupportedParams || raw.query !== canonicalQuery

  return {
    state,
    href,
    ...(needsRedirect ? { redirectHref: href } : {}),
  }
}

export const buildListHref = <State>(
  state: State,
  buildSearchParams: (state: State, page?: number) => URLSearchParams,
  basePath: string,
  page: number,
): string => {
  const params = buildSearchParams(state, page)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export type ListSortDirection = 'asc' | 'desc'

/**
 * The sort-toggle algorithm every list repeats (P3-F): clicking the active key
 * flips its direction, clicking another key applies that key's default — and
 * either way the list returns to page 1. Domain modules supply their data
 * (current sort, default dir, href builder); the B18 contract stays frozen
 * because the href still goes through the domain's own serializer.
 */
export const createSortToggleHref =
  <State, Key extends string>(config: {
    resolveCurrentSort: (state: State) => { sort: Key; dir: ListSortDirection }
    defaultDir: (key: Key) => ListSortDirection
    buildHref: (state: State) => string
  }) =>
  (state: State, nextKey: Key): string => {
    const current = config.resolveCurrentSort(state)
    const dir: ListSortDirection =
      current.sort === nextKey
        ? current.dir === 'asc'
          ? 'desc'
          : 'asc'
        : config.defaultDir(nextKey)

    return config.buildHref({ ...state, sort: nextKey, dir, page: 1 } as State)
  }
