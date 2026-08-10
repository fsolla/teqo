/**
 * People list URL contract (C100): state, param parse/canonicalize, source-level
 * Payload `where`s and hrefs. Own module, same shape as `leadershipListUrl` —
 * no sort in v1: the merged list is name-ordered by construction.
 *
 * The three source-level wheres only cover what a single domain collection can
 * express (`q` everywhere, `statuses`/`municipalities` on leadership). Capacity
 * and the deputy/staff municipality filters are applied in memory over the
 * merged rows (`peopleData.ts`) — reverse relations and cross-source unions.
 */
import type { Where } from 'payload'

import { leadershipSupportStatuses, type SupportStatus } from '@/lib/schemas/leadership'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import { PEOPLE_CAPACITIES, type PeopleCapacity } from '@/utilities/people/peopleLabels'

export const peoplePageSize = 25

export type PeopleListState = {
  page: number
  q?: string
  capacities?: PeopleCapacity[]
  municipalities?: number[]
  statuses?: SupportStatus[]
}

export type PeopleListSearchParams = RawSearchParams

const peopleListParamNames = ['q', 'capacity', 'municipality', 'status', 'page'] as const
const peopleListParamNameSet = new Set<string>(peopleListParamNames)

const peopleCapacitySet = new Set<string>(PEOPLE_CAPACITIES)
const supportStatusSet = new Set<string>(leadershipSupportStatuses)

export const parsePeopleListParams = (params: PeopleListSearchParams): PeopleListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const capacities = parseExhaustiveEnumParam<PeopleCapacity>(params.capacity, peopleCapacitySet)
  const municipalities = allParamValues(params.municipality)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)
  const statuses = parseExhaustiveEnumParam<SupportStatus>(params.status, supportStatusSet)

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(capacities.length ? { capacities } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(statuses.length ? { statuses } : {}),
  }
}

export const peopleListStateToRawParams = (
  state: PeopleListState,
  page = state.page,
): PeopleListSearchParams => ({
  page: String(page),
  q: state.q,
  capacity: state.capacities,
  municipality: state.municipalities?.map(String),
  status: state.statuses,
})

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalPeopleListSearchParams = (
  canonicalState: PeopleListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const capacity of canonicalState.capacities ?? []) params.append('capacity', capacity)
  for (const municipality of canonicalState.municipalities ?? []) {
    params.append('municipality', String(municipality))
  }
  for (const status of canonicalState.statuses ?? []) params.append('status', status)
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildPeopleListSearchParams = (state: PeopleListState, page = state.page): URLSearchParams =>
  serializeCanonicalPeopleListSearchParams(
    parsePeopleListParams(peopleListStateToRawParams(state, page)),
  )

export const buildPeopleListHref = (state: PeopleListState, page: number): string =>
  buildListHref(state, buildPeopleListSearchParams, '/campanha/pessoas', page)

export const resolvePeopleListUrl = (
  params: PeopleListSearchParams,
  totalPages?: number,
): {
  state: PeopleListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: peopleListParamNameSet,
    parse: parsePeopleListParams,
    buildSearchParams: buildPeopleListSearchParams,
    basePath: '/campanha/pessoas',
    totalPages,
  })

/** Leadership source: `q` + the domain filters a leadership row can express. */
export const buildPeopleLeadershipSourceWhere = (state: PeopleListState): Where => {
  const filters: Where[] = []
  if (state.q) filters.push({ 'contact.name': { contains: state.q } })
  if (state.statuses?.length) filters.push({ supportStatus: { in: state.statuses } })
  if (state.municipalities?.length) {
    filters.push({ municipalities: { in: state.municipalities } })
  }
  return filters.length ? { and: filters } : {}
}

/** Dobradinha source: `q` only (municipalities are a reverse relation — in memory). */
export const buildPeopleDeputySourceWhere = (state: PeopleListState): Where => {
  const filters: Where[] = []
  if (state.q) filters.push({ 'contact.name': { contains: state.q } })
  return filters.length ? { and: filters } : {}
}

/** Staff source: every staff account with a ficha (carteira is in memory). */
export const buildPeopleStaffSourceWhere = (state: PeopleListState): Where => {
  const filters: Where[] = [
    { role: { in: ['advisor', 'coordinator', 'candidate'] } },
    { contact: { exists: true } },
  ]
  if (state.q) filters.push({ 'contact.name': { contains: state.q } })
  return { and: filters }
}
