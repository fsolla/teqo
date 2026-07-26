export type RawSearchParams = Record<string, string | string[] | undefined>

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
