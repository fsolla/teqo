/**
 * Municipality list URL contract: state type, param parsing/canonicalization,
 * Payload `where`, serialization and sort. Split out of the former
 * `municipalityUi.ts` in Pass 2 W1. The URL contract is frozen — B18 (saved
 * filters) depends on it.
 */
import type { Where } from 'payload'

import { type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { type CampaignColumnPickerColumn } from '@/lib/campaignColumnVisibility'
import { engagementLevels, type EngagementLevel } from '@/lib/engagementLevel'
import { isMunicipalitySlug } from '@/lib/municipalityCatalog'
import {
  allParamValues,
  buildListHref,
  createSortToggleHref,
  firstValue,
  normalizedText,
  parseExhaustiveEnumParam,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams as CampaignListRawSearchParams,
} from '@/utilities/campaignListUrl'
import {
  politicalTrendLabels,
  territorialClassLabels,
  type MunicipalityListColumnId,
  type PoliticalTrendStatus,
} from '@/utilities/municipality/municipalityLabels'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { parseTerritoryRegionsParam } from '@/utilities/territory/territoryRegionParam'

export const municipalityPageSize = 25

export type MunicipalityListSortKey =
  | 'name'
  | 'region'
  | 'trend'
  | 'expectedVotes'
  | 'lastUpdateAt'
  | 'coverage'
  | 'votos'
  | 'deficit'
  | 'frescor'
  | 'classe'
  | 'nivel'

export type MunicipalityListSortDirection = 'asc' | 'desc'

/**
 * E14 filter values: the five levels plus the absence of one. "Sem nível" is
 * a real answer here — it is the triage queue — so it is a selectable value
 * and not the empty selection.
 *
 * Same sentinel convention as `NO_PARTY_FILTER_VALUE` in `stateDeputyListUrl`
 * (second call site; a third should extract the pair sentinel + `exists: false`
 * branch). Unlike `party`, the level is a closed enum, so it also gets the
 * "all selected → absent" canonicalization of `parseExhaustiveEnumParam`.
 */
export const NO_LEVEL_FILTER_VALUE = 'sem_nivel'

export type MunicipalityListLevelFilterValue = EngagementLevel | typeof NO_LEVEL_FILTER_VALUE

export const municipalityListLevelFilterValues: readonly MunicipalityListLevelFilterValue[] = [
  ...engagementLevels,
  NO_LEVEL_FILTER_VALUE,
]

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
  trend: 'Tendência',
  expectedVotes: 'Votos estimados',
  lastUpdateAt: 'Última atualização',
  /** Sorts the "Assessores" column — "Cobertura" alone now reads as the goal one (`deficit`). */
  coverage: 'Assessores',
  /** Short header — definition lives on hover (`formatMunicipalityConcentrationHint`). */
  votos: '2022',
  deficit: 'Cobertura',
  frescor: 'Frescor do sinal',
  classe: 'Classe',
  nivel: 'Nível',
}

/**
 * B17 — the name each column answers to in the column picker. Nine of the
 * eleven quote the sort label, and the header renders that same record
 * (`MunicipalitySortableHead` falls back to it when given no children, which
 * is why those heads pass none), so renaming a header renames the menu entry
 * with it. The two that differ do so on purpose: a header sits above its own
 * data and can be telegraphic, while the same word alone in a list of column
 * names says nothing. `lastSignal` is read back by the header it names.
 */
export const municipalityColumnLabels: Record<MunicipalityListColumnId, string> = {
  name: municipalityListSortLabels.name,
  /** Header is the bare year, under the "2022" group of the table. */
  votos: 'Votação 2022',
  expectedVotes: 'Estimativa 2026',
  level: municipalityListSortLabels.nivel,
  classe: municipalityListSortLabels.classe,
  advisors: 'Assessor',
  trend: municipalityListSortLabels.trend,
  leaderships: 'Liderança',
  stateDeputies: 'Dobradinha',
  goalCoverage: municipalityListSortLabels.deficit,
  /** The column shows the signal; `frescor` sorts by how old it is. */
  lastSignal: 'Sinal',
  lastUpdateAt: municipalityListSortLabels.lastUpdateAt,
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
  /**
   * Multi-select (OR) E14 engagement levels, including "sem nível". Stored,
   * so unlike `classes` this one IS part of `buildMunicipalityListWhere`.
   * Never holds the full set (same "todos" canonicalization as `trends`).
   */
  levels?: MunicipalityListLevelFilterValue[]
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
  'coverage',
  'priority',
  'trend',
  'class',
  'level',
  'compare',
  'sort',
  'dir',
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
  // Ordinal too: descending opens on N4, where the campaign is most invested.
  'nivel',
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

export const isDefaultMunicipalityListSort = (state: MunicipalityListState): boolean => {
  const { sort, dir } = resolveMunicipalityListSort(state)
  return sort === DEFAULT_MUNICIPALITY_LIST_SORT_KEY && dir === defaultMunicipalityListSortDir(sort)
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
    const label = municipalityListSortLabels.deficit
    return dir === 'desc'
      ? `Ordenado por ${label} (maior déficit primeiro)`
      : `Ordenado por ${label} (menor déficit primeiro)`
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
  if (sort === 'nivel') {
    return dir === 'desc' ? 'Ordenado por nível (N4 primeiro)' : 'Ordenado por nível (N0 primeiro)'
  }
  const label = municipalityListSortLabels[sort]
  return dir === 'desc' ? `Ordenado por ${label} ↓` : `Ordenado por ${label} ↑`
}

const parseRegionsParam = parseTerritoryRegionsParam

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
const territorialClassSet = new Set<string>(Object.keys(territorialClassLabels))
const engagementLevelFilterSet = new Set<string>(municipalityListLevelFilterValues)

export const municipalityListStateToRawParams = (
  state: MunicipalityListState,
): MunicipalityListSearchParams => ({
  q: state.q,
  region: state.regions,
  slug: state.slugs,
  advisor: state.advisors?.map(String),
  coverage: state.coverage,
  priority: state.priority,
  trend: state.trends,
  class: state.classes,
  level: state.levels,
  compare: state.compare === undefined ? undefined : String(state.compare),
  sort: state.sort,
  dir: state.dir,
})

export const parseMunicipalityListParams = (
  params: MunicipalityListSearchParams,
): MunicipalityListState => {
  const q = normalizedText(firstValue(params.q))
  const regions = parseRegionsParam(params.region)
  const slugs = parseSlugsParam(params.slug)
  const advisors = parseAdvisorsParam(params.advisor)
  const rawCoverage = firstValue(params.coverage)
  const rawPriority = firstValue(params.priority)
  const trends = parseExhaustiveEnumParam<PoliticalTrendStatus>(
    params.trend,
    politicalTrendStatusSet,
  )
  const classes = parseExhaustiveEnumParam<MunicipalityTerritorialClass>(
    params.class,
    territorialClassSet,
  )
  const levels = parseExhaustiveEnumParam<MunicipalityListLevelFilterValue>(
    params.level,
    engagementLevelFilterSet,
  )
  const rawCompare = strictDecimalInteger(firstValue(params.compare))
  const rawSort = firstValue(params.sort) as MunicipalityListSortKey | undefined
  const sort = rawSort && municipalityListSortKeySet.has(rawSort) ? rawSort : undefined
  const rawDir = firstValue(params.dir) as MunicipalityListSortDirection | undefined
  const dir = rawDir && municipalityListSortDirSet.has(rawDir) ? rawDir : undefined

  return {
    // B161 — continuous list: `page` left the URL contract; pinned at 1.
    page: 1,
    ...(q ? { q } : {}),
    ...(regions.length ? { regions } : {}),
    ...(slugs.length ? { slugs } : {}),
    ...(advisors.length ? { advisors } : {}),
    ...(rawCoverage === 'com_assessor' || rawCoverage === 'sem_assessor'
      ? { coverage: rawCoverage }
      : {}),
    ...(rawPriority === 'alta' ? { priority: 'alta' } : {}),
    ...(trends.length ? { trends } : {}),
    ...(classes.length ? { classes } : {}),
    ...(levels.length ? { levels } : {}),
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
  if (state.coverage) {
    filters.push({
      advisors: { exists: state.coverage === 'com_assessor' },
    })
  }
  if (state.priority) filters.push({ priority: { equals: state.priority } })
  if (state.trends?.length) filters.push({ 'politicalTrend.status': { in: state.trends } })
  if (state.levels?.length) {
    // "Sem nível" is absence, which no `in` can express — it rides along as an
    // OR branch so "N0 ou sem nível" (the triage view) is one query.
    const selectedLevels = state.levels.filter(
      (level): level is EngagementLevel => level !== NO_LEVEL_FILTER_VALUE,
    )
    const levelFilters: Where[] = []
    if (selectedLevels.length) levelFilters.push({ engagementLevel: { in: selectedLevels } })
    if (state.levels.includes(NO_LEVEL_FILTER_VALUE)) {
      levelFilters.push({ engagementLevel: { exists: false } })
    }
    const [onlyFilter, ...restFilters] = levelFilters
    filters.push(onlyFilter && restFilters.length === 0 ? onlyFilter : { or: levelFilters })
  }
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
  if (canonicalState.coverage) params.set('coverage', canonicalState.coverage)
  if (canonicalState.priority) params.set('priority', canonicalState.priority)
  for (const trend of canonicalState.trends ?? []) params.append('trend', trend)
  for (const territorialClass of canonicalState.classes ?? []) {
    params.append('class', territorialClass)
  }
  for (const level of canonicalState.levels ?? []) params.append('level', level)
  if (canonicalState.compare) params.set('compare', String(canonicalState.compare))
  // Omit the default pair (staff: deficit+desc). Keep `sort` whenever the pair
  // is non-default so `dir` is never orphaned (e.g. votos+asc → sort=votos&dir=asc).
  if (!isListDefault) {
    params.set('sort', resolvedSort)
    if (resolvedDir !== defaultMunicipalityListSortDir(resolvedSort)) {
      params.set('dir', resolvedDir)
    }
  }

  return params
}

const buildMunicipalityListSearchParams = (state: MunicipalityListState): URLSearchParams =>
  serializeCanonicalMunicipalityListSearchParams(
    parseMunicipalityListParams(municipalityListStateToRawParams(state)),
  )

export const buildMunicipalityListHref = (state: MunicipalityListState): string =>
  buildListHref(state, buildMunicipalityListSearchParams, '/campanha/municipios')

export const buildMunicipalitySortHref = createSortToggleHref<
  MunicipalityListState,
  MunicipalityListSortKey
>({
  resolveCurrentSort: (state) => {
    const sort = state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY
    return { sort, dir: state.dir ?? defaultMunicipalityListSortDir(sort) }
  },
  defaultDir: defaultMunicipalityListSortDir,
  buildHref: buildMunicipalityListHref,
})

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
  if (key === 'nivel') {
    return dir === 'asc' ? `${base} (N0 primeiro)` : `${base} (N4 primeiro)`
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

export const resolveMunicipalityListUrl = (
  params: MunicipalityListSearchParams,
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
  })

/**
 * B161 — the column picker list for `/campanha/municipios`. Lives here (not in
 * the client `MunicipalityList`) because the RSC page composes the picker
 * trailing; pure data, safe on both sides of the boundary.
 */
export const municipalityListPickerColumns = ({
  isStaffView,
  isCampaignUnrestricted,
}: {
  isStaffView: boolean
  isCampaignUnrestricted: boolean
}): CampaignColumnPickerColumn[] => {
  const base: CampaignColumnPickerColumn[] = [
    { id: 'name', label: municipalityColumnLabels.name, mandatory: true },
    { id: 'votos', label: municipalityColumnLabels.votos },
  ]
  if (!isStaffView) return base

  return [
    ...base,
    { id: 'expectedVotes', label: municipalityColumnLabels.expectedVotes },
    { id: 'level', label: municipalityColumnLabels.level },
    { id: 'classe', label: municipalityColumnLabels.classe },
    { id: 'advisors', label: municipalityColumnLabels.advisors },
    { id: 'trend', label: municipalityColumnLabels.trend },
    { id: 'leaderships', label: municipalityColumnLabels.leaderships },
    ...(isCampaignUnrestricted
      ? [{ id: 'stateDeputies', label: municipalityColumnLabels.stateDeputies }]
      : []),
    { id: 'goalCoverage', label: municipalityColumnLabels.goalCoverage },
    { id: 'lastSignal', label: municipalityColumnLabels.lastSignal },
  ]
}
