/**
 * People list URL contract (C100, C117): state, param parse/canonicalize,
 * source-level Payload `where`s and hrefs. Own module, same shape as
 * `leadershipListUrl`. Sort (`sort`/`dir`) and absence filters (`ausencia`)
 * are C117; the sort is applied in memory over the filtered merge
 * (`peopleData.ts`), never pushed to a source where.
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
  createSortToggleHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import { PEOPLE_CAPACITIES, type PeopleCapacity } from '@/utilities/people/peopleLabels'

export const peoplePageSize = 25

export type PeopleListSortKey =
  | 'name'
  | 'contact'
  | 'assessora'
  | 'lidera'
  | 'aliada'
  | 'assessorado'
  | 'base'
  | 'party'

export type PeopleListSortDirection = 'asc' | 'desc'

/**
 * C117 — absence facets ("Sem assessor", "Sem base", "Sem contato"). Each
 * value is a pure absence predicate over the merged row; the facet is OR
 * within itself (same semantics as every multi-select facet) and AND with the
 * other filters. C125 — `qualquer_ausencia` is the umbrella value: the union
 * of the three predicates, so "fichas incompletas" is a single chip instead of
 * the three-specific combination collapsing under B18 (with 4 members,
 * selecting the 3 specifics no longer equals "all members").
 */
export const PEOPLE_ABSENCES = [
  'sem_assessor',
  'sem_base',
  'sem_contato',
  'qualquer_ausencia',
] as const
export type PeopleAbsence = (typeof PEOPLE_ABSENCES)[number]

export const peopleAbsenceLabels: Record<PeopleAbsence, string> = {
  sem_assessor: 'Sem assessor',
  sem_base: 'Sem base',
  sem_contato: 'Sem contato',
  qualquer_ausencia: 'Qualquer ausência',
}

export type PeopleListState = {
  page: number
  q?: string
  capacities?: PeopleCapacity[]
  municipalities?: number[]
  statuses?: SupportStatus[]
  ausencias?: PeopleAbsence[]
  parties?: string[]
  sort?: PeopleListSortKey
  dir?: PeopleListSortDirection
}

export type PeopleListSearchParams = RawSearchParams

const peopleListParamNames = [
  'q',
  'capacity',
  'municipality',
  'status',
  'ausencia',
  'party',
  'sort',
  'dir',
  'page',
] as const
const peopleListParamNameSet = new Set<string>(peopleListParamNames)

const peopleCapacitySet = new Set<string>(PEOPLE_CAPACITIES)
const supportStatusSet = new Set<string>(leadershipSupportStatuses)

/**
 * Sort keys: the columns visible by default, PLUS `base` and `party` —
 * invisible C130 keys kept because the gate decided both sortings stay
 * useful without a column (city sorts under the name; party sorts the
 * inline `(party)` suffix). `email` stays excluded as before (C117
 * anti-goal: no ordering by a toggleable hidden column). Derived from the
 * label record so a new key is one line here.
 */
export const peopleListSortLabels: Record<PeopleListSortKey, string> = {
  name: 'Nome',
  contact: 'Contato',
  assessora: 'Assessora',
  lidera: 'Lidera',
  aliada: 'Dobra em',
  assessorado: 'Assessorado',
  base: 'Base',
  party: 'Partido',
}

const peopleListSortKeySet = new Set<string>(Object.keys(peopleListSortLabels))
const peopleListSortDirSet = new Set<PeopleListSortDirection>(['asc', 'desc'])
const peopleAbsenceSet = new Set<string>(PEOPLE_ABSENCES)

/**
 * C125 — ausência parse with the umbrella absorbing the specifics. This facet
 * deliberately does NOT use `parseExhaustiveEnumParam`: once
 * `qualquer_ausencia` exists, selecting every member is NOT the same filter as
 * selecting none (the umbrella means "any absence"), so the generic B18
 * collapse would fire on the 4th click — the exact "chips vanish" bug this
 * issue fixes, one click further. The umbrella subsumes the three specifics
 * (one canonical "any absence" chip) while the 3-specific combination stays
 * compositional (each chip individually removable).
 */
const parsePeopleAbsenceParam = (raw: string | string[] | undefined): PeopleAbsence[] => {
  const values = allParamValues(raw).filter((token): token is PeopleAbsence =>
    peopleAbsenceSet.has(token),
  )
  return values.includes('qualquer_ausencia') ? ['qualquer_ausencia'] : values
}

/** Categorical/textual keys open A–Z; count keys open on the biggest first. */
const peopleSortKeysWithDescDefault = new Set<PeopleListSortKey>([
  'assessora',
  'lidera',
  'aliada',
  'assessorado',
])

export const defaultPeopleListSortDir = (key: PeopleListSortKey): PeopleListSortDirection =>
  peopleSortKeysWithDescDefault.has(key) ? 'desc' : 'asc'

export const resolvePeopleListSort = (
  state: PeopleListState,
): { sort: PeopleListSortKey; dir: PeopleListSortDirection } => {
  const sort = state.sort ?? 'name'
  return { sort, dir: state.dir ?? defaultPeopleListSortDir(sort) }
}

export const isDefaultPeopleListSort = (state: PeopleListState): boolean => {
  const { sort, dir } = resolvePeopleListSort(state)
  return sort === 'name' && dir === defaultPeopleListSortDir('name')
}

export const parsePeopleListParams = (params: PeopleListSearchParams): PeopleListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const capacities = parseExhaustiveEnumParam<PeopleCapacity>(params.capacity, peopleCapacitySet)
  const municipalities = allParamValues(params.municipality)
    .map((token) => strictDecimalInteger(token))
    .filter((id): id is number => typeof id === 'number' && id > 0)
  const statuses = parseExhaustiveEnumParam<SupportStatus>(params.status, supportStatusSet)
  const ausencias = parsePeopleAbsenceParam(params.ausencia)
  // C130 — the party facet is DATA-DRIVEN (free text on `stateDeputy.party`,
  // maxLength 32), so values are validated structurally, never against an
  // enum — the municipalities facet precedent. `allParamValues` already
  // trims, dedupes and drops empties.
  const parties = allParamValues(params.party).filter((token) => token.length <= 32)
  const rawSort = firstValue(params.sort)
  const sort =
    rawSort && peopleListSortKeySet.has(rawSort) ? (rawSort as PeopleListSortKey) : undefined
  const rawDir = firstValue(params.dir)
  const dir =
    rawDir && peopleListSortDirSet.has(rawDir as PeopleListSortDirection)
      ? (rawDir as PeopleListSortDirection)
      : undefined

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(capacities.length ? { capacities } : {}),
    ...(municipalities.length ? { municipalities } : {}),
    ...(statuses.length ? { statuses } : {}),
    ...(ausencias.length ? { ausencias } : {}),
    ...(parties.length ? { parties } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
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
  ausencia: state.ausencias,
  party: state.parties,
  sort: state.sort,
  dir: state.dir,
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
  for (const ausencia of canonicalState.ausencias ?? []) params.append('ausencia', ausencia)
  for (const party of canonicalState.parties ?? []) params.append('party', party)
  if (!isDefaultPeopleListSort(canonicalState)) {
    const { sort, dir } = resolvePeopleListSort(canonicalState)
    params.set('sort', sort)
    if (dir !== defaultPeopleListSortDir(sort)) params.set('dir', dir)
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildPeopleListSearchParams = (state: PeopleListState, page = state.page): URLSearchParams =>
  serializeCanonicalPeopleListSearchParams(
    parsePeopleListParams(peopleListStateToRawParams(state, page)),
  )

export const buildPeopleListHref = (state: PeopleListState, page: number): string =>
  buildListHref(state, buildPeopleListSearchParams, '/campanha/pessoas', page)

export const buildPeopleSortHref = createSortToggleHref<PeopleListState, PeopleListSortKey>({
  resolveCurrentSort: resolvePeopleListSort,
  defaultDir: defaultPeopleListSortDir,
  buildHref: (state) => buildPeopleListHref(state, 1),
})

const peopleSortOptionLabel = (key: PeopleListSortKey, dir: PeopleListSortDirection): string => {
  const label = peopleListSortLabels[key]
  if (key === 'name' || key === 'contact' || key === 'base' || key === 'party') {
    return `${label} (${dir === 'asc' ? 'A–Z' : 'Z–A'})`
  }
  return `${label} (${dir === 'asc' ? 'menor → maior' : 'maior → menor'})`
}

export const peopleListSortOptions = (
  Object.keys(peopleListSortLabels) as PeopleListSortKey[]
).flatMap((key) =>
  (['asc', 'desc'] as const).map((dir) => ({ key, dir, label: peopleSortOptionLabel(key, dir) })),
)

/**
 * C125 — the omnibox sort catalog: ONE option per key, in the key's default
 * direction. Mobile has no sortable headers, and the shared omnibox cap (8 per
 * group) cuts the 14-key×dir catalog before `aliada`/`assessorado`/`base`;
 * the primary direction is the intended reading (rankings biggest first, text
 * A–Z), and desktop headers keep flipping to the secondary one.
 */
export const peopleListSortPrimaryOptions = peopleListSortOptions.filter(
  ({ key, dir }) => dir === defaultPeopleListSortDir(key),
)

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
