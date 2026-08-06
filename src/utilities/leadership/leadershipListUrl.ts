/**
 * Leadership list URL contract: state, param parse/canonicalize, Payload
 * `where`, sort and hrefs. Own module (same shape as `stateDeputyListUrl`) —
 * does not import municipality/territory list modules.
 */
import type { Where } from 'payload'

import { leadershipSupportStatuses, type SupportStatus } from '@/lib/schemas/leadership'
import {
  allParamValues,
  buildListHref,
  createSortToggleHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const leadershipPageSize = 25

export type LeadershipListSortKey = 'name' | 'supportStatus' | 'updatedAt'
export type LeadershipListSortDirection = 'asc' | 'desc'

/** Acesso ao app — exclusive filter (com | sem), same shape as municipality coverage. */
type LeadershipListAccessFilter = 'com' | 'sem'

export type LeadershipListState = {
  page: number
  q?: string
  statuses?: SupportStatus[]
  municipalities?: number[]
  organizations?: number[]
  stateDeputies?: number[]
  access?: LeadershipListAccessFilter
  sort?: LeadershipListSortKey
  dir?: LeadershipListSortDirection
}

export type LeadershipListSearchParams = RawSearchParams

const leadershipListParamNames = [
  'q',
  'status',
  'municipality',
  'organization',
  'stateDeputy',
  'access',
  'sort',
  'dir',
] as const
const leadershipListParamNameSet = new Set<string>(leadershipListParamNames)

const DEFAULT_LEADERSHIP_LIST_SORT_KEY: LeadershipListSortKey = 'updatedAt'
const DEFAULT_LEADERSHIP_LIST_SORT_DIR: LeadershipListSortDirection = 'desc'

export const leadershipListSortLabels: Record<LeadershipListSortKey, string> = {
  name: 'Nome',
  supportStatus: 'Status',
  updatedAt: 'Última atualização',
}

const leadershipListSortKeySet = new Set<string>(Object.keys(leadershipListSortLabels))
const leadershipListSortDirSet = new Set<LeadershipListSortDirection>(['asc', 'desc'])
const supportStatusSet = new Set<string>(leadershipSupportStatuses)
const accessFilterSet = new Set<LeadershipListAccessFilter>(['com', 'sem'])

/** Temporal = newest first; categorical/name = A–Z. */
export const defaultLeadershipListSortDir = (
  key: LeadershipListSortKey,
): LeadershipListSortDirection => (key === 'updatedAt' ? 'desc' : 'asc')

export const resolveLeadershipListSort = (
  state: LeadershipListState,
): { sort: LeadershipListSortKey; dir: LeadershipListSortDirection } => {
  const sort = state.sort ?? DEFAULT_LEADERSHIP_LIST_SORT_KEY
  return { sort, dir: state.dir ?? defaultLeadershipListSortDir(sort) }
}

/** Dotted path for Contact name join; `-` prefix for descending. */
export const resolveLeadershipListPayloadSort = (
  sort: LeadershipListSortKey,
  dir: LeadershipListSortDirection,
): string => {
  const path = sort === 'name' ? 'contact.name' : sort
  return dir === 'desc' ? `-${path}` : path
}

export const formatLeadershipListSortSummary = (
  sort: LeadershipListSortKey,
  dir: LeadershipListSortDirection,
): string => {
  const label = leadershipListSortLabels[sort]
  if (sort === 'updatedAt') {
    return dir === 'desc'
      ? `Ordenado por ${label} (mais recente)`
      : `Ordenado por ${label} (mais antigo)`
  }
  return dir === 'asc' ? `Ordenado por ${label} (A–Z)` : `Ordenado por ${label} (Z–A)`
}

export const leadershipListStateToRawParams = (
  state: LeadershipListState,
): LeadershipListSearchParams => ({
  q: state.q,
  status: state.statuses,
  municipality: state.municipalities?.map(String),
  organization: state.organizations?.map(String),
  stateDeputy: state.stateDeputies?.map(String),
  access: state.access,
  sort: state.sort,
  dir: state.dir,
})

export const parseLeadershipListParams = (
  params: LeadershipListSearchParams,
): LeadershipListState => {
  const q = normalizedText(firstValue(params.q))
  const statuses = parseExhaustiveEnumParam<SupportStatus>(params.status, supportStatusSet)
  const municipalities = allParamValues(params.municipality)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)
  const organizations = allParamValues(params.organization)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)
  const stateDeputies = allParamValues(params.stateDeputy)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)
  const rawAccess = firstValue(params.access)
  const access =
    rawAccess && accessFilterSet.has(rawAccess as LeadershipListAccessFilter)
      ? (rawAccess as LeadershipListAccessFilter)
      : undefined
  const rawSort = firstValue(params.sort)
  const sort =
    rawSort && leadershipListSortKeySet.has(rawSort)
      ? (rawSort as LeadershipListSortKey)
      : undefined
  const rawDir = firstValue(params.dir)
  const dir =
    rawDir && leadershipListSortDirSet.has(rawDir as LeadershipListSortDirection)
      ? (rawDir as LeadershipListSortDirection)
      : undefined

  return {
    // B161 — continuous list: `page` left the URL contract; the state field
    // stays (shared `ListStateWithPage` machinery) pinned at 1.
    page: 1,
    ...(q ? { q } : {}),
    ...(statuses.length ? { statuses } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(organizations.length ? { organizations } : {}),
    ...(stateDeputies.length ? { stateDeputies } : {}),
    ...(access ? { access } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
  }
}

export const buildLeadershipListWhere = (state: LeadershipListState): Where => {
  const filters: Where[] = []
  if (state.q) filters.push({ 'contact.name': { contains: state.q } })
  if (state.statuses?.length) filters.push({ supportStatus: { in: state.statuses } })
  if (state.municipalities?.length) {
    filters.push({ municipalities: { in: state.municipalities } })
  }
  if (state.organizations?.length) {
    filters.push({ organizations: { in: state.organizations } })
  }
  if (state.stateDeputies?.length) {
    filters.push({ stateDeputies: { in: state.stateDeputies } })
  }
  if (state.access) {
    filters.push({ user: { exists: state.access === 'com' } })
  }
  return filters.length ? { and: filters } : {}
}

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalLeadershipListSearchParams = (
  canonicalState: LeadershipListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  const resolvedSort = canonicalState.sort ?? DEFAULT_LEADERSHIP_LIST_SORT_KEY
  const resolvedDir = canonicalState.dir ?? defaultLeadershipListSortDir(resolvedSort)
  const isSortDefault =
    resolvedSort === DEFAULT_LEADERSHIP_LIST_SORT_KEY &&
    resolvedDir === DEFAULT_LEADERSHIP_LIST_SORT_DIR

  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const status of canonicalState.statuses ?? []) params.append('status', status)
  for (const municipality of canonicalState.municipalities ?? []) {
    params.append('municipality', String(municipality))
  }
  for (const organization of canonicalState.organizations ?? []) {
    params.append('organization', String(organization))
  }
  for (const stateDeputy of canonicalState.stateDeputies ?? []) {
    params.append('stateDeputy', String(stateDeputy))
  }
  if (canonicalState.access) params.set('access', canonicalState.access)
  if (!isSortDefault) {
    params.set('sort', resolvedSort)
    if (resolvedDir !== defaultLeadershipListSortDir(resolvedSort)) {
      params.set('dir', resolvedDir)
    }
  }

  return params
}

const buildLeadershipListSearchParams = (state: LeadershipListState): URLSearchParams =>
  serializeCanonicalLeadershipListSearchParams(
    parseLeadershipListParams(leadershipListStateToRawParams(state)),
  )

export const buildLeadershipListHref = (state: LeadershipListState): string =>
  buildListHref(state, buildLeadershipListSearchParams, '/campanha/liderancas')

export const buildLeadershipSortHref = createSortToggleHref<
  LeadershipListState,
  LeadershipListSortKey
>({
  resolveCurrentSort: resolveLeadershipListSort,
  defaultDir: defaultLeadershipListSortDir,
  buildHref: buildLeadershipListHref,
})

export const resolveLeadershipListUrl = (
  params: LeadershipListSearchParams,
): {
  state: LeadershipListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: leadershipListParamNameSet,
    parse: parseLeadershipListParams,
    buildSearchParams: buildLeadershipListSearchParams,
    basePath: '/campanha/liderancas',
  })
