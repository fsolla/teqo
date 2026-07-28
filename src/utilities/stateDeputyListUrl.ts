/**
 * State deputy ("dobradinha") list URL contract: state type, param
 * parsing/canonicalization, Payload `where`, sort resolution and hrefs.
 * Mirrors `municipalityListUrl.ts` (paginated, `resolveListUrl` clamp) and
 * `territoryListUrl.ts` / `leadershipListUrl.ts` (lean sort-key/label shape)
 * without importing either.
 */
import type { Where } from 'payload'

import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const stateDeputyPageSize = 25

export type StateDeputyListSortKey = 'name' | 'party'
export type StateDeputyListSortDirection = 'asc' | 'desc'

/**
 * Sentinel for the "Sem partido" filter row — `party` is a free-text optional
 * field (no closed enum to validate a real value against), so this constant
 * is the only reserved token; a dobradinha whose actual party name collided
 * with it would be indistinguishable, an accepted precedent-level risk (the
 * curated field spans a couple dozen Brazilian party acronyms).
 */
export const NO_PARTY_FILTER_VALUE = 'sem_partido'

export type StateDeputyListState = {
  page: number
  q?: string
  /** Multi-select (OR) party names, plus the `NO_PARTY_FILTER_VALUE` sentinel. */
  parties?: string[]
  sort?: StateDeputyListSortKey
  dir?: StateDeputyListSortDirection
}

export type StateDeputyListSearchParams = RawSearchParams

const stateDeputyListParamNames = ['q', 'party', 'sort', 'dir', 'page'] as const
const stateDeputyListParamNameSet = new Set<string>(stateDeputyListParamNames)

const DEFAULT_STATE_DEPUTY_LIST_SORT_KEY: StateDeputyListSortKey = 'name'
const DEFAULT_STATE_DEPUTY_LIST_SORT_DIR: StateDeputyListSortDirection = 'asc'

export const stateDeputyListSortLabels: Record<StateDeputyListSortKey, string> = {
  name: 'Nome',
  party: 'Partido',
}

const stateDeputyListSortKeySet = new Set<string>(Object.keys(stateDeputyListSortLabels))
const stateDeputyListSortDirSet = new Set<StateDeputyListSortDirection>(['asc', 'desc'])

/** Both sort keys default to ascending (A–Z) — no "biggest first" semantics here. */
export const defaultStateDeputyListSortDir = (): StateDeputyListSortDirection =>
  DEFAULT_STATE_DEPUTY_LIST_SORT_DIR

export const resolveStateDeputyListSort = (
  state: StateDeputyListState,
): { sort: StateDeputyListSortKey; dir: StateDeputyListSortDirection } => {
  const sort = state.sort ?? DEFAULT_STATE_DEPUTY_LIST_SORT_KEY
  return { sort, dir: state.dir ?? defaultStateDeputyListSortDir() }
}

/** `payload.find({ sort })` string — `-` prefix for descending. */
export const resolveStateDeputyListPayloadSort = (
  sort: StateDeputyListSortKey,
  dir: StateDeputyListSortDirection,
): string => (dir === 'desc' ? `-${sort}` : sort)

export const formatStateDeputyListSortSummary = (
  sort: StateDeputyListSortKey,
  dir: StateDeputyListSortDirection,
): string => {
  const label = stateDeputyListSortLabels[sort]
  return dir === 'asc' ? `Ordenado por ${label} (A–Z)` : `Ordenado por ${label} (Z–A)`
}

export const stateDeputyListStateToRawParams = (
  state: StateDeputyListState,
  page = state.page,
): StateDeputyListSearchParams => ({
  page: String(page),
  q: state.q,
  party: state.parties,
  sort: state.sort,
  dir: state.dir,
})

export const parseStateDeputyListParams = (
  params: StateDeputyListSearchParams,
): StateDeputyListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  // `allParamValues` already trims and dedupes; only the length cap is ours.
  const parties = allParamValues(params.party).filter((token) => token.length <= 32)
  const rawSort = firstValue(params.sort)
  const sort =
    rawSort && stateDeputyListSortKeySet.has(rawSort)
      ? (rawSort as StateDeputyListSortKey)
      : undefined
  const rawDir = firstValue(params.dir)
  const dir =
    rawDir && stateDeputyListSortDirSet.has(rawDir as StateDeputyListSortDirection)
      ? (rawDir as StateDeputyListSortDirection)
      : undefined

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(parties.length ? { parties } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
  }
}

export const buildStateDeputyListWhere = (state: StateDeputyListState): Where => {
  const filters: Where[] = []
  if (state.q) filters.push({ name: { contains: state.q } })

  if (state.parties?.length) {
    const namedParties = state.parties.filter((party) => party !== NO_PARTY_FILTER_VALUE)
    const includesNoParty = state.parties.includes(NO_PARTY_FILTER_VALUE)
    const partyFilters: Where[] = []
    if (namedParties.length) partyFilters.push({ party: { in: namedParties } })
    if (includesNoParty) partyFilters.push({ party: { exists: false } })
    // Every entry in a non-empty `parties` is named or the sentinel (or both),
    // so `partyFilters` always has at least one member here.
    filters.push(partyFilters.length > 1 ? { or: partyFilters } : partyFilters[0])
  }

  return filters.length ? { and: filters } : {}
}

/**
 * Serializes a state that is ALREADY canonical (came out of
 * `parseStateDeputyListParams`, or was derived from a canonical state by a
 * rule-preserving toggle) — same private-ish contract as
 * `serializeCanonicalMunicipalityListSearchParams`.
 */
export const serializeCanonicalStateDeputyListSearchParams = (
  canonicalState: StateDeputyListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  const resolvedSort = canonicalState.sort ?? DEFAULT_STATE_DEPUTY_LIST_SORT_KEY
  const resolvedDir = canonicalState.dir ?? defaultStateDeputyListSortDir()
  const isSortDefault =
    resolvedSort === DEFAULT_STATE_DEPUTY_LIST_SORT_KEY &&
    resolvedDir === DEFAULT_STATE_DEPUTY_LIST_SORT_DIR

  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const party of canonicalState.parties ?? []) params.append('party', party)
  if (!isSortDefault) {
    params.set('sort', resolvedSort)
    if (resolvedDir !== DEFAULT_STATE_DEPUTY_LIST_SORT_DIR) params.set('dir', resolvedDir)
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

const buildStateDeputyListSearchParams = (
  state: StateDeputyListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalStateDeputyListSearchParams(
    parseStateDeputyListParams(stateDeputyListStateToRawParams(state, page)),
  )

export const buildStateDeputyListHref = (state: StateDeputyListState, page: number): string =>
  buildListHref(state, buildStateDeputyListSearchParams, '/campanha/dobradinhas', page)

export const buildStateDeputySortHref = (
  state: StateDeputyListState,
  nextKey: StateDeputyListSortKey,
): string => {
  const current = resolveStateDeputyListSort(state)
  const dir =
    current.sort === nextKey
      ? current.dir === 'asc'
        ? 'desc'
        : 'asc'
      : DEFAULT_STATE_DEPUTY_LIST_SORT_DIR

  return buildStateDeputyListHref({ ...state, sort: nextKey, dir, page: 1 }, 1)
}

const sortOptionLabel = (key: StateDeputyListSortKey, dir: StateDeputyListSortDirection): string =>
  `${stateDeputyListSortLabels[key]} (${dir === 'asc' ? 'A–Z' : 'Z–A'})`

export const stateDeputyListSortOptions = (
  Object.keys(stateDeputyListSortLabels) as StateDeputyListSortKey[]
).flatMap((key) =>
  (['asc', 'desc'] as const).map((dir) => ({ key, dir, label: sortOptionLabel(key, dir) })),
)

export const serializeStateDeputySortValue = (
  key: StateDeputyListSortKey,
  dir: StateDeputyListSortDirection,
): string => `${key}|${dir}`

export const parseStateDeputySortValue = (
  value: string,
): { key: StateDeputyListSortKey; dir: StateDeputyListSortDirection } | null => {
  const [key, dir] = value.split('|')
  if (!stateDeputyListSortKeySet.has(key)) return null
  if (!stateDeputyListSortDirSet.has(dir as StateDeputyListSortDirection)) return null
  return { key: key as StateDeputyListSortKey, dir: dir as StateDeputyListSortDirection }
}

export const resolveStateDeputyListUrl = (
  params: StateDeputyListSearchParams,
  totalPages?: number,
): {
  state: StateDeputyListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: stateDeputyListParamNameSet,
    parse: parseStateDeputyListParams,
    buildSearchParams: buildStateDeputyListSearchParams,
    basePath: '/campanha/dobradinhas',
    totalPages,
  })
