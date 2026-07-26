/**
 * Municipality list URL contract: state type, param parsing/canonicalization,
 * Payload `where`, serialization and sort. Split out of the former
 * `municipalityUi.ts` in Pass 2 W1. The URL contract is frozen — B18 (saved
 * filters) depends on it.
 */
import type { Where } from 'payload'

import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { isMunicipalitySlug } from '@/lib/municipalityCatalog'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import {
  politicalTrendLabels,
  territorialClassLabels,
  type PoliticalTrendStatus,
} from '@/utilities/municipalityLabels'
import type { MunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'

import type { Municipality } from '@/payload-types'

export const municipalityPageSize = 25

export type MunicipalityListSortKey =
  | 'name'
  | 'region'
  | 'kind'
  | 'trend'
  | 'expectedVotes'
  | 'lastUpdateAt'
  | 'coverage'
  | 'votos'
  | 'deficit'
  | 'frescor'
  | 'classe'

export type MunicipalityListSortDirection = 'asc' | 'desc'

/**
 * E9 allocation queue: the list opens on the decision it exists to serve —
 * where the goal is least covered by auditable commitments (biggest deficit
 * first), in the `central` scenario. Since E9 anchored the suggested goal on
 * the candidate's own 2022 vote, this ordering stays close to the previous
 * `votos` default instead of surfacing deserts with inflated goals.
 */
const DEFAULT_MUNICIPALITY_LIST_SORT_KEY: MunicipalityListSortKey = 'deficit'

export const municipalityListSortLabels: Record<MunicipalityListSortKey, string> = {
  name: 'Município',
  region: 'Território',
  kind: 'Tipo',
  trend: 'Tendência',
  expectedVotes: 'Votos estimados',
  lastUpdateAt: 'Última atualização',
  /** Sorts the "Assessores" column — "Cobertura" alone now reads as the goal one (`deficit`). */
  coverage: 'Assessores',
  /** Short header — definition lives on hover (`formatMunicipalityConcentrationHint`). */
  votos: '2022',
  deficit: 'Cobertura da meta',
  frescor: 'Frescor do sinal',
  classe: 'Classe',
}

export type MunicipalityListState = {
  page: number
  q?: string
  /** Multi-select (OR) identity territories. */
  regions?: BahiaIdentityTerritory[]
  /** Multi-select (OR) catalog slugs. */
  slugs?: string[]
  /** Multi-select (OR) campaignUser advisor IDs. */
  advisors?: number[]
  kind?: Municipality['kind']
  coverage?: 'com_assessor' | 'sem_assessor'
  priority?: 'alta'
  /**
   * Multi-select (OR) political trends. Never holds the full set: "todas" is
   * encoded as absent, canonicalized by `parseMunicipalityListParams`.
   */
  trends?: PoliticalTrendStatus[]
  /**
   * Multi-select (OR) E10 territorial classes. Derived from the committed TSE
   * artifact, so — unlike every filter above — it is NOT part of
   * `buildMunicipalityListWhere`: `municipalityPageData` applies it in memory.
   * Never holds the full set (same "todas" canonicalization as `trends`).
   */
  classes?: MunicipalityTerritorialClass[]
  /** Candidate number for the map comparison mode (does not filter the list). */
  compare?: number
  sort?: MunicipalityListSortKey
  dir?: MunicipalityListSortDirection
}

export type MunicipalityListSearchParams = CampaignListRawSearchParams

const municipalityListParamNames = [
  'q',
  'region',
  'slug',
  'advisor',
  'kind',
  'coverage',
  'priority',
  'trend',
  'class',
  'compare',
  'sort',
  'dir',
  'page',
] as const

const municipalityListParamNameSet = new Set<string>(municipalityListParamNames)

// Derived from the label record (total over the union), so a new sort key is
// declared in the type and the labels only.
const municipalityListSortKeySet = new Set<string>(Object.keys(municipalityListSortLabels))

const municipalityListSortDirSet = new Set<MunicipalityListSortDirection>(['asc', 'desc'])

const sortKeysWithDescDefault: MunicipalityListSortKey[] = [
  'expectedVotes',
  'lastUpdateAt',
  'votos',
  // Both open on the worst case: biggest uncovered deficit, coldest signal.
  'deficit',
  'frescor',
  // Ordinal, not alphabetical: descending means reduto first.
  'classe',
]

export const defaultMunicipalityListSortDir = (
  key: MunicipalityListSortKey,
): MunicipalityListSortDirection => (sortKeysWithDescDefault.includes(key) ? 'desc' : 'asc')

export const resolveMunicipalityListSort = (
  state: MunicipalityListState,
): { sort: MunicipalityListSortKey; dir: MunicipalityListSortDirection } => {
  const sort = state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
  const dir = state.dir ?? defaultMunicipalityListSortDir(sort)
  return { sort, dir }
}

export const formatMunicipalityListSortSummary = (
  sort: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => {
  if (sort === 'votos') {
    return dir === 'desc' ? 'Ordenado por 2022 ↓' : 'Ordenado por 2022 ↑'
  }
  if (sort === 'name') {
    return dir === 'asc' ? 'Ordenado por nome (A–Z)' : 'Ordenado por nome (Z–A)'
  }
  if (sort === 'deficit') {
    return dir === 'desc'
      ? 'Ordenado por déficit da meta (maior primeiro)'
      : 'Ordenado por déficit da meta (menor primeiro)'
  }
  if (sort === 'frescor') {
    return dir === 'desc'
      ? 'Ordenado por frescor (sinal mais frio primeiro)'
      : 'Ordenado por frescor (sinal mais recente primeiro)'
  }
  if (sort === 'classe') {
    return dir === 'desc'
      ? 'Ordenado por classe (reduto primeiro)'
      : 'Ordenado por classe (marginal primeiro)'
  }
  const label = municipalityListSortLabels[sort]
  return dir === 'desc' ? `Ordenado por ${label} ↓` : `Ordenado por ${label} ↑`
}

const canonicalTerritoryBySearchValue = new Map(
  bahiaIdentityTerritories.map((territory) => [normalizeSearchPhrase(territory), territory]),
)

const parseRegionsParam = (raw: string | string[] | undefined): BahiaIdentityTerritory[] => {
  const regions: BahiaIdentityTerritory[] = []
  const seen = new Set<BahiaIdentityTerritory>()
  for (const token of allParamValues(raw)) {
    const region = canonicalTerritoryBySearchValue.get(normalizeSearchPhrase(token))
    if (!region || seen.has(region)) continue
    seen.add(region)
    regions.push(region)
  }
  return regions
}

const parseSlugsParam = (raw: string | string[] | undefined): string[] => {
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const token of allParamValues(raw)) {
    if (!isMunicipalitySlug(token) || seen.has(token)) continue
    seen.add(token)
    slugs.push(token)
  }
  return slugs
}

const parseAdvisorsParam = (raw: string | string[] | undefined): number[] => {
  const advisors: number[] = []
  const seen = new Set<number>()
  for (const token of allParamValues(raw)) {
    const id = strictDecimalInteger(token)
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    advisors.push(id)
  }
  return advisors.sort((left, right) => left - right)
}

const politicalTrendStatusSet = new Set<string>(Object.keys(politicalTrendLabels))

/** Selecting every trend means "todas", which is the same thing as selecting none. */
const parseTrendsParam = (raw: string | string[] | undefined): PoliticalTrendStatus[] => {
  const trends: PoliticalTrendStatus[] = []
  for (const token of allParamValues(raw)) {
    if (!politicalTrendStatusSet.has(token)) continue
    const trend = token as PoliticalTrendStatus
    if (trends.includes(trend)) continue
    trends.push(trend)
  }
  return trends.length < politicalTrendStatusSet.size ? trends : []
}

const territorialClassSet = new Set<string>(Object.keys(territorialClassLabels))

/** Same "todas = nenhuma" canonicalization as `parseTrendsParam`. */
const parseClassesParam = (raw: string | string[] | undefined): MunicipalityTerritorialClass[] => {
  const classes: MunicipalityTerritorialClass[] = []
  for (const token of allParamValues(raw)) {
    if (!territorialClassSet.has(token)) continue
    const territorialClass = token as MunicipalityTerritorialClass
    if (classes.includes(territorialClass)) continue
    classes.push(territorialClass)
  }
  return classes.length < territorialClassSet.size ? classes : []
}

export const municipalityListStateToRawParams = (
  state: MunicipalityListState,
  page = state.page,
): MunicipalityListSearchParams => ({
  page: String(page),
  q: state.q,
  region: state.regions,
  slug: state.slugs,
  advisor: state.advisors?.map(String),
  kind: state.kind,
  coverage: state.coverage,
  priority: state.priority,
  trend: state.trends,
  class: state.classes,
  compare: state.compare === undefined ? undefined : String(state.compare),
  sort: state.sort,
  dir: state.dir,
})

export const parseMunicipalityListParams = (
  params: MunicipalityListSearchParams,
): MunicipalityListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const regions = parseRegionsParam(params.region)
  const slugs = parseSlugsParam(params.slug)
  const advisors = parseAdvisorsParam(params.advisor)
  const rawKind = firstValue(params.kind)
  const rawCoverage = firstValue(params.coverage)
  const rawPriority = firstValue(params.priority)
  const trends = parseTrendsParam(params.trend)
  const classes = parseClassesParam(params.class)
  const rawCompare = strictDecimalInteger(firstValue(params.compare))
  const rawSort = firstValue(params.sort) as MunicipalityListSortKey | undefined
  const sort = rawSort && municipalityListSortKeySet.has(rawSort) ? rawSort : undefined
  const rawDir = firstValue(params.dir) as MunicipalityListSortDirection | undefined
  const dir = rawDir && municipalityListSortDirSet.has(rawDir) ? rawDir : undefined

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(regions.length ? { regions } : {}),
    ...(slugs.length ? { slugs } : {}),
    ...(advisors.length ? { advisors } : {}),
    ...(rawKind === 'municipio' || rawKind === 'zona' ? { kind: rawKind } : {}),
    ...(rawCoverage === 'com_assessor' || rawCoverage === 'sem_assessor'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawPriority === 'alta' ? { priority: 'alta' } : {}),
    ...(trends.length ? { trends } : {}),
    ...(classes.length ? { classes } : {}),
    ...(rawCompare && rawCompare <= 99999 ? { compare: rawCompare } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
  }
}

export const buildMunicipalityListWhere = (state: MunicipalityListState): Where => {
  const filters: Where[] = []
  const searchedZone = strictDecimalInteger(state.q)

  if (state.q) {
    const searchFilters: Where[] = [{ name: { contains: state.q } }]
    if (searchedZone && searchedZone <= 999) {
      searchFilters.push({ zoneNumber: { equals: searchedZone } })
    }
    filters.push({ or: searchFilters })
  }
  if (state.regions?.length) filters.push({ region: { in: state.regions } })
  if (state.slugs?.length) filters.push({ slug: { in: state.slugs } })
  if (state.advisors?.length) filters.push({ advisors: { in: state.advisors } })
  if (state.kind) filters.push({ kind: { equals: state.kind } })
  if (state.coverage) {
    filters.push({
      advisors: { exists: state.coverage === 'com_assessor' },
    })
  }
  if (state.priority) filters.push({ priority: { equals: state.priority } })
  if (state.trends?.length) filters.push({ 'politicalTrend.status': { in: state.trends } })
  // `state.classes` is absent on purpose: the class is derived from the TSE
  // artifact, not stored, so it can't be a Payload constraint. `municipalityPageData`
  // filters it in memory over the unpaginated scope.

  return filters.length ? { and: filters } : {}
}

/**
 * Serializes a state that is ALREADY canonical (came out of
 * `parseMunicipalityListParams`, or was derived from a canonical state by a
 * rule-preserving toggle). Kept private-ish so the public builder below stays
 * the only entry point that accepts arbitrary states.
 */
export const serializeCanonicalMunicipalityListSearchParams = (
  canonicalState: MunicipalityListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  const resolvedSort = canonicalState.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
  const resolvedDir = canonicalState.dir ?? defaultMunicipalityListSortDir(resolvedSort)
  const isListDefault =
    resolvedSort === DEFAULT_MUNICIPALITY_LIST_SORT_KEY &&
    resolvedDir === defaultMunicipalityListSortDir(DEFAULT_MUNICIPALITY_LIST_SORT_KEY)

  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const region of canonicalState.regions ?? []) params.append('region', region)
  for (const slug of canonicalState.slugs ?? []) params.append('slug', slug)
  for (const advisor of canonicalState.advisors ?? []) params.append('advisor', String(advisor))
  if (canonicalState.kind) params.set('kind', canonicalState.kind)
  if (canonicalState.coverage) params.set('coverage', canonicalState.coverage)
  if (canonicalState.priority) params.set('priority', canonicalState.priority)
  for (const trend of canonicalState.trends ?? []) params.append('trend', trend)
  for (const territorialClass of canonicalState.classes ?? []) {
    params.append('class', territorialClass)
  }
  if (canonicalState.compare) params.set('compare', String(canonicalState.compare))
  // Omit the default pair (staff: deficit+desc). Keep `sort` whenever the pair
  // is non-default so `dir` is never orphaned (e.g. votos+asc → sort=votos&dir=asc).
  if (!isListDefault) {
    params.set('sort', resolvedSort)
    if (resolvedDir !== defaultMunicipalityListSortDir(resolvedSort)) {
      params.set('dir', resolvedDir)
    }
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))

  return params
}

const buildMunicipalityListSearchParams = (
  state: MunicipalityListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalMunicipalityListSearchParams(
    parseMunicipalityListParams(municipalityListStateToRawParams(state, page)),
  )

export const buildMunicipalityFiltersKey = (state: MunicipalityListState): string =>
  buildMunicipalityListSearchParams(state).toString()

export const buildMunicipalityListHref = (state: MunicipalityListState, page: number): string =>
  buildListHref(state, buildMunicipalityListSearchParams, '/campanha/municipios', page)

export const buildMunicipalitySortHref = (
  state: MunicipalityListState,
  nextKey: MunicipalityListSortKey,
): string => {
  const currentSort = state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
  const currentDir = state.dir ?? defaultMunicipalityListSortDir(currentSort)

  let dir: MunicipalityListSortDirection
  if (nextKey === currentSort) {
    dir = currentDir === 'asc' ? 'desc' : 'asc'
  } else {
    dir = defaultMunicipalityListSortDir(nextKey)
  }

  const updatedState: MunicipalityListState = {
    ...state,
    sort: nextKey,
    dir,
    page: 1,
  }

  return buildMunicipalityListHref(updatedState, 1)
}

const formatMunicipalitySortOptionLabel = (
  key: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => {
  const base = municipalityListSortLabels[key]
  if (key === 'expectedVotes' || key === 'votos') {
    return dir === 'asc' ? `${base} (menor → maior)` : `${base} (maior → menor)`
  }
  if (key === 'lastUpdateAt') {
    return dir === 'asc' ? `${base} (mais antiga)` : `${base} (mais recente)`
  }
  if (key === 'deficit') {
    return dir === 'asc' ? `${base} (mais coberta)` : `${base} (mais descoberta)`
  }
  if (key === 'frescor') {
    return dir === 'asc' ? `${base} (mais recente)` : `${base} (mais frio)`
  }
  if (key === 'classe') {
    return dir === 'asc' ? `${base} (marginal primeiro)` : `${base} (reduto primeiro)`
  }
  return dir === 'asc' ? `${base} (A–Z)` : `${base} (Z–A)`
}

export const municipalityListSortOptions = (
  Object.keys(municipalityListSortLabels) as MunicipalityListSortKey[]
).flatMap((key) => [
  { key, dir: 'asc' as const, label: formatMunicipalitySortOptionLabel(key, 'asc') },
  { key, dir: 'desc' as const, label: formatMunicipalitySortOptionLabel(key, 'desc') },
])

export const serializeMunicipalitySortValue = (
  key: MunicipalityListSortKey,
  dir: MunicipalityListSortDirection,
): string => `${key}|${dir}`

export const parseMunicipalitySortValue = (
  value: string,
): { key: MunicipalityListSortKey; dir: MunicipalityListSortDirection } | null => {
  const [rawKey, rawDir] = value.split('|')
  if (!municipalityListSortKeySet.has(rawKey as MunicipalityListSortKey)) return null
  if (!municipalityListSortDirSet.has(rawDir as MunicipalityListSortDirection)) return null
  return { key: rawKey as MunicipalityListSortKey, dir: rawDir as MunicipalityListSortDirection }
}

export const shouldUpdateMunicipalitySearchUrl = (
  input: string,
  currentQ: string | undefined,
): boolean => normalizedText(input) !== currentQ

export const resolveMunicipalityListUrl = (
  params: MunicipalityListSearchParams,
  totalPages?: number,
): {
  state: MunicipalityListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: municipalityListParamNameSet,
    parse: parseMunicipalityListParams,
    buildSearchParams: buildMunicipalityListSearchParams,
    basePath: '/campanha/municipios',
    totalPages,
  })
