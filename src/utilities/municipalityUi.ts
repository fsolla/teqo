import type { Where } from 'payload'

import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { formatElectionNumber } from '@/lib/electionInsights'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { CampaignUser, Municipality } from '@/payload-types'
import {
  allParamValues,
  buildListHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import { latestIsoTimestamp } from '@/utilities/campaignTime'
import { normalizeSearchPhrase } from '@/utilities/wordStartFilter'

export const municipalityPageSize = 25

export const municipalityKindLabels: Record<Municipality['kind'], string> = {
  municipio: 'Município',
  zona: 'Zona eleitoral',
}

export const municipalityPriorityLabels: Record<NonNullable<Municipality['priority']>, string> = {
  alta: 'Prioritária',
  normal: 'Normal',
}

export type PoliticalTrendStatus = NonNullable<
  NonNullable<Municipality['politicalTrend']>['status']
>

export const politicalTrendLabels: Record<PoliticalTrendStatus, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export const politicalTrendBadgeVariant = {
  favoravel: 'estimate-confirmed',
  neutra: 'secondary',
  desfavoravel: 'destructive',
} as const

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

export type MunicipalityListSortDirection = 'asc' | 'desc'

/**
 * E9 allocation queue: the list opens on the decision it exists to serve —
 * where the goal is least covered by auditable commitments (biggest deficit
 * first), in the `central` scenario. Since E9 anchored the suggested goal on
 * the candidate's own 2022 vote, this ordering stays close to the previous
 * `votos` default instead of surfacing deserts with inflated goals.
 */
export const DEFAULT_MUNICIPALITY_LIST_SORT_KEY: MunicipalityListSortKey = 'deficit'
export const DEFAULT_MUNICIPALITY_LIST_SORT_DIR: MunicipalityListSortDirection = 'desc'

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
  /** Candidate number for the map comparison mode (does not filter the list). */
  compare?: number
  sort?: MunicipalityListSortKey
  dir?: MunicipalityListSortDirection
}

export type MunicipalityListSearchParams = CampaignListRawSearchParams

export const municipalityListParamNames = [
  'q',
  'region',
  'slug',
  'advisor',
  'kind',
  'coverage',
  'priority',
  'trend',
  'compare',
  'sort',
  'dir',
  'page',
] as const

const municipalitySlugSet = new Set(municipalityCatalog.map((entry) => entry.slug))
const municipalityNameBySlug = new Map(
  municipalityCatalog.map((entry) => [entry.slug, entry.name] as const),
)

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

export const formatMunicipalityConcentrationHint = (
  totalUnits: number = municipalityCatalog.length,
): string =>
  `Percentual da votação estadual do candidato neste município — não o % dos válidos locais. Colocação: posição no catálogo de ${formatElectionNumber(totalUnits)} unidades.`

/**
 * E9 frescor — the last time ANYBODY recorded something here: a staff update
 * or a leadership pledge declaration/estimate. One rule, shared by the server
 * ordering (`municipalityPageData.ts`) and the list cell, so "há N dias"
 * never disagrees with the position in the queue.
 */
export const resolveMunicipalityLastSignalAt = (
  lastUpdateAt: string | null,
  lastPledgeAt: string | null,
): string | null => latestIsoTimestamp(lastUpdateAt, lastPledgeAt)

/**
 * Days since the last signal, floored. The research report only says a
 * commitment left untouched "for weeks" is worth less, so the threshold below
 * is a convention (3 weeks), not a measured decay curve.
 */
export const MUNICIPALITY_COLD_SIGNAL_DAYS = 21

export const municipalitySignalAgeInDays = (
  lastSignalAt: string | null,
  now: Date = new Date(),
): number | null => {
  if (!lastSignalAt) return null
  const elapsed = now.getTime() - new Date(lastSignalAt).getTime()
  if (Number.isNaN(elapsed)) return null
  return Math.max(0, Math.floor(elapsed / 86_400_000))
}

export const isMunicipalitySignalCold = (ageInDays: number | null): boolean =>
  ageInDays === null || ageInDays >= MUNICIPALITY_COLD_SIGNAL_DAYS

/**
 * "há 3 dias" / "hoje" / "Sem sinal" — dense cell copy for the queue.
 * Deliberately not `formatRelativeAge`: its `numeric: 'auto'` yields "ontem"/
 * "anteontem" and minute/hour granularity, which breaks both the day-based
 * cold threshold and the tabular-nums scan down the column.
 */
export const formatMunicipalitySignalAgeLabel = (ageInDays: number | null): string => {
  if (ageInDays === null) return 'Sem sinal'
  if (ageInDays === 0) return 'hoje'
  if (ageInDays === 1) return 'há 1 dia'
  return `há ${ageInDays} dias`
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
    if (!municipalitySlugSet.has(token) || seen.has(token)) continue
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

const municipalityListStateToRawParams = (
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

  return filters.length ? { and: filters } : {}
}

export const buildMunicipalityListSearchParams = (
  state: MunicipalityListState,
  page = state.page,
): URLSearchParams => {
  const canonicalState = parseMunicipalityListParams(municipalityListStateToRawParams(state, page))
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

export const formatMunicipalitySortOptionLabel = (
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

export const municipalityListCoverageLabels: Record<
  NonNullable<MunicipalityListState['coverage']>,
  string
> = {
  com_assessor: 'Com assessor',
  sem_assessor: 'Sem assessor',
}

/** Column-header filter affordances (B16+). `name` = Município (priority + slugs). */
export type MunicipalityFilterParam = 'name' | 'region' | 'kind' | 'coverage' | 'trend' | 'advisor'

type MunicipalityFilterSelectionMode = 'single' | 'multi' | 'toggle'

export type MunicipalityFilterOption = {
  value: string
  label: string
}

/** Catalog labels for a (possibly cross-filtered) slug list. */
export const municipalityFilterOptionsForSlugs = (
  slugs: readonly string[],
): MunicipalityFilterOption[] =>
  slugs.map((slug) => ({ value: slug, label: municipalityNameBySlug.get(slug) ?? slug }))

export type MunicipalityFilterDefinition = {
  param: MunicipalityFilterParam
  label: string
  /** Shown for exclusive single-select clear row; omitted for toggle/multi. */
  allLabel?: string
  staffOnly: boolean
  selection: MunicipalityFilterSelectionMode
  /** Absent for the params whose options are cross-filtered server-side. */
  options?: MunicipalityFilterOption[]
}

export const municipalityFilterDefinitions: MunicipalityFilterDefinition[] = [
  {
    param: 'name',
    label: 'Município',
    staffOnly: false,
    selection: 'multi',
  },
  {
    param: 'region',
    label: 'Território',
    staffOnly: false,
    selection: 'multi',
  },
  {
    param: 'kind',
    label: 'Tipo',
    allLabel: 'Todos',
    staffOnly: false,
    selection: 'single',
    options: (
      Object.keys(municipalityKindLabels) as Array<keyof typeof municipalityKindLabels>
    ).map((kind) => ({ value: kind, label: municipalityKindLabels[kind] })),
  },
  {
    param: 'advisor',
    label: 'Assessores',
    staffOnly: true,
    selection: 'multi',
  },
  {
    param: 'coverage',
    label: 'Assessoria',
    staffOnly: true,
    selection: 'toggle',
    options: (
      Object.keys(municipalityListCoverageLabels) as Array<
        keyof typeof municipalityListCoverageLabels
      >
    ).map((coverage) => ({ value: coverage, label: municipalityListCoverageLabels[coverage] })),
  },
  {
    param: 'trend',
    label: 'Tendência',
    staffOnly: true,
    selection: 'multi',
    options: (Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>).map(
      (trend) => ({ value: trend, label: politicalTrendLabels[trend] }),
    ),
  },
]

const municipalityFilterDefinitionByParam = Object.fromEntries(
  municipalityFilterDefinitions.map((definition) => [definition.param, definition]),
) as Record<MunicipalityFilterParam, MunicipalityFilterDefinition>

export const getMunicipalityFilterDefinition = (
  param: MunicipalityFilterParam,
): MunicipalityFilterDefinition => municipalityFilterDefinitionByParam[param]

export const getMunicipalitySingleFilterValue = (
  state: MunicipalityListState,
  param: 'kind' | 'coverage',
): string | undefined => state[param]

export type MunicipalityMultiFilterParam = 'region' | 'slug' | 'advisor' | 'trend'

export const getMunicipalityMultiFilterValues = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
): string[] => {
  if (param === 'region') return state.regions ?? []
  if (param === 'slug') return state.slugs ?? []
  if (param === 'trend') return state.trends ?? []
  return (state.advisors ?? []).map(String)
}

const withMunicipalityListPageReset = (state: MunicipalityListState): MunicipalityListState =>
  parseMunicipalityListParams(municipalityListStateToRawParams({ ...state, page: 1 }, 1))

/** Exclusive single-value set/clear for `kind`. Empty (or invalid) clears. */
export const applyMunicipalityKindFilter = (
  state: MunicipalityListState,
  value: string | undefined,
): MunicipalityListState =>
  parseMunicipalityListParams({
    ...municipalityListStateToRawParams({ ...state, page: 1 }, 1),
    kind: value || undefined,
  })

/** Toggle exclusivity: clicking the active value clears (coverage). */
export const toggleMunicipalityExclusiveFilterValue = (
  state: MunicipalityListState,
  param: 'coverage',
  value: string,
): MunicipalityListState =>
  withMunicipalityListPageReset({
    ...state,
    [param]: state[param] === value ? undefined : (value as MunicipalityListState['coverage']),
  })

export const toggleMunicipalityPriorityFilter = (
  state: MunicipalityListState,
): MunicipalityListState =>
  withMunicipalityListPageReset({
    ...state,
    priority: state.priority === 'alta' ? undefined : 'alta',
  })

/**
 * Writes the RAW param and lets `parseMunicipalityListParams` validate, so no
 * branch has to cast a `string[]` into the state's narrow value types.
 */
const setMunicipalityMultiFilterValues = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
  values: string[],
): MunicipalityListState =>
  parseMunicipalityListParams({
    ...municipalityListStateToRawParams({ ...state, page: 1 }, 1),
    [param]: values,
  })

export const toggleMunicipalityMultiFilterValue = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
  value: string,
): MunicipalityListState => {
  const current = getMunicipalityMultiFilterValues(state, param)
  return setMunicipalityMultiFilterValues(
    state,
    param,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  )
}

export const clearMunicipalityMultiFilter = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
): MunicipalityListState => setMunicipalityMultiFilterValues(state, param, [])

/** Clear municipality-column filters (priority + selected slugs). */
export const clearMunicipalityNameFilters = (state: MunicipalityListState): MunicipalityListState =>
  withMunicipalityListPageReset({ ...state, priority: undefined, slugs: undefined })

/** Clear advisor-column filters (com/sem assessor + selected advisors). */
export const clearMunicipalityAdvisorFilters = (
  state: MunicipalityListState,
): MunicipalityListState =>
  withMunicipalityListPageReset({ ...state, coverage: undefined, advisors: undefined })

export const buildMunicipalityFilterHref = (next: MunicipalityListState): string =>
  buildMunicipalityListHref(next, 1)

export const isMunicipalityColumnFilterActive = (
  state: MunicipalityListState,
  param: MunicipalityFilterParam,
): boolean => {
  switch (param) {
    case 'name':
      return Boolean(state.priority || state.slugs?.length)
    case 'region':
      return Boolean(state.regions?.length)
    case 'advisor':
      // The Assessores popover also owns the com/sem assessor toggle.
      return Boolean(state.advisors?.length || state.coverage)
    case 'kind':
      return Boolean(state.kind)
    case 'coverage':
      return Boolean(state.coverage)
    case 'trend':
      return Boolean(state.trends?.length)
  }
}

/** "Irecê, Recôncavo +3" — the summary never grows past two names per filter. */
const firstNamesLabel = (names: string[]): string =>
  names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`

export const formatMunicipalityActiveFiltersSummary = (
  state: MunicipalityListState,
): string | null => {
  const parts: string[] = []
  if (state.priority) parts.push(municipalityPriorityLabels.alta)
  if (state.slugs?.length) {
    parts.push(firstNamesLabel(state.slugs.map((slug) => municipalityNameBySlug.get(slug) ?? slug)))
  }
  if (state.regions?.length) parts.push(firstNamesLabel([...state.regions]))
  if (state.kind) parts.push(municipalityKindLabels[state.kind])
  if (state.advisors?.length) {
    parts.push(state.advisors.length === 1 ? '1 assessor' : `${state.advisors.length} assessores`)
  }
  if (state.coverage) parts.push(municipalityListCoverageLabels[state.coverage])
  if (state.trends?.length) {
    parts.push(
      `Tendência ${state.trends.map((trend) => politicalTrendLabels[trend].toLowerCase()).join(', ')}`,
    )
  }
  if (state.q) parts.push(`Busca "${state.q}"`)

  return parts.length ? parts.join(' · ') : null
}

const MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH = 80

export const buildMunicipalityListVisitLabel = (state: MunicipalityListState): string | null => {
  const summary = formatMunicipalityActiveFiltersSummary(state)
  if (!summary) return null

  const label = `Municípios · ${summary}`
  if (label.length <= MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH) return label
  return `${label.slice(0, MAX_MUNICIPALITY_LIST_VISIT_LABEL_LENGTH - 1)}…`
}

export const buildMunicipalityListVisitHref = (state: MunicipalityListState): string =>
  buildMunicipalityListHref(state, 1)

export const getCampaignScopeLabel = (
  role: CampaignUser['role'],
  municipalityCount: number,
): string => {
  if (role === 'advisor') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'município sob sua assessoria' : 'municípios sob sua assessoria'}`
  }
  if (role === 'leader') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'município em que você atua' : 'municípios em que você atua'}`
  }
  return `${municipalityCount} ${municipalityCount === 1 ? 'município' : 'municípios'}`
}

/** Short human description of a municipality's geography, e.g. "Chapada Diamantina · ZE 105". */
export const formatMunicipalityGeographyLabel = (municipality: {
  region: string
  kind: Municipality['kind']
  zoneNumber?: number | null
}): string =>
  municipality.kind === 'zona' && municipality.zoneNumber != null
    ? `${municipality.region} · ZE ${municipality.zoneNumber}`
    : municipality.region
