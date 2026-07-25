/**
 * Municipality list filter affordances (B16 header popovers + mobile bar):
 * definitions, selection helpers and the active-filters summary. Split out of
 * the former `municipalityUi.ts` in Pass 2 W1.
 */
import { isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  municipalityKindLabels,
  municipalityListCoverageLabels,
  municipalityPriorityLabels,
  politicalTrendLabels,
  type PoliticalTrendStatus,
} from '@/utilities/municipalityLabels'
import {
  buildMunicipalityListHref,
  municipalityListStateToRawParams,
  parseMunicipalityListParams,
  serializeCanonicalMunicipalityListSearchParams,
  type MunicipalityListState,
} from '@/utilities/municipalityListUrl'

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
  slugs.map((slug) => ({ value: slug, label: getMunicipalityCatalogEntry(slug)?.name ?? slug }))

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

/**
 * The "Limpar" contract shared by the filter bar and the empty state: drop
 * every filter and the search, keep the sort.
 */
export const clearMunicipalityListFilters = (
  state: MunicipalityListState,
): MunicipalityListState => ({ page: 1, sort: state.sort, dir: state.dir })

export const buildMunicipalityFilterHref = (next: MunicipalityListState): string =>
  buildMunicipalityListHref(next, 1)

const trendStatusCount = Object.keys(politicalTrendLabels).length

const isPoliticalTrendStatus = (value: string): value is PoliticalTrendStatus =>
  value in politicalTrendLabels

/**
 * B16+ href fast path: option rows only need the WOULD-BE href, so the toggled
 * state is derived with the same canonical rules the parser applies (advisors
 * numerically sorted, the full trend set collapsing to "todas" = absent)
 * instead of a full parse round-trip per rendered option — the popover renders
 * up to 435 of these per open.
 */
export const buildMunicipalityFilterOptionHref = (
  canonicalState: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
  value: string,
): string => {
  const current = getMunicipalityMultiFilterValues(canonicalState, param)
  const toggled = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]

  const next: MunicipalityListState = { ...canonicalState, page: 1 }
  if (param === 'region') {
    const regions = toggled.filter(isBahiaIdentityTerritory)
    if (regions.length) next.regions = regions
    else delete next.regions
  } else if (param === 'slug') {
    const slugs = toggled.filter((slug) => getMunicipalityCatalogEntry(slug) !== undefined)
    if (slugs.length) next.slugs = slugs
    else delete next.slugs
  } else if (param === 'advisor') {
    const advisors = toggled
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .sort((left, right) => left - right)
    if (advisors.length) next.advisors = advisors
    else delete next.advisors
  } else {
    const trends = toggled.filter(isPoliticalTrendStatus)
    if (trends.length && trends.length < trendStatusCount) next.trends = trends
    else delete next.trends
  }

  const query = serializeCanonicalMunicipalityListSearchParams(next).toString()
  return query ? `/campanha/municipios?${query}` : '/campanha/municipios'
}

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
    parts.push(
      firstNamesLabel(state.slugs.map((slug) => getMunicipalityCatalogEntry(slug)?.name ?? slug)),
    )
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
