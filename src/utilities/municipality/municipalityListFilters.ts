/**
 * Municipality list filter affordances (B16 header popovers + mobile bar):
 * definitions, selection helpers and the active-filters summary. Split out of
 * the former `municipalityUi.ts` in Pass 2 W1.
 */
import { isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { EMPTY_ENGAGEMENT_LEVEL_LABEL, formatEngagementLevelLabel } from '@/lib/engagementLevel'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { truncatedNamesLabel } from '@/utilities/campaignListUrl'
import {
  municipalityListCoverageLabels,
  municipalityPriorityLabels,
  politicalTrendLabels,
  territorialClassLabels,
  type PoliticalTrendStatus,
} from '@/utilities/municipality/municipalityLabels'
import {
  buildMunicipalityListHref,
  municipalityListLevelFilterValues,
  municipalityListStateToRawParams,
  NO_LEVEL_FILTER_VALUE,
  parseMunicipalityListParams,
  serializeCanonicalMunicipalityListSearchParams,
  type MunicipalityListLevelFilterValue,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'

/** Column-header filter affordances (B16+). `name` = Município (priority + slugs). */
export type MunicipalityFilterParam =
  | 'name'
  | 'region'
  | 'coverage'
  | 'trend'
  | 'class'
  | 'level'
  | 'advisor'

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
  {
    param: 'class',
    label: 'Classe',
    staffOnly: true,
    selection: 'multi',
    options: (
      Object.keys(territorialClassLabels) as Array<keyof typeof territorialClassLabels>
    ).map((territorialClass) => ({
      value: territorialClass,
      label: territorialClassLabels[territorialClass],
    })),
  },
  {
    param: 'level',
    label: 'Nível',
    staffOnly: true,
    selection: 'multi',
    // Static options, like `trend`: the ladder is a closed set, so offering
    // only the levels currently in use would hide the empty rungs the mesa is
    // deciding to fill. "Sem nível" is an option because it is the triage queue.
    options: municipalityListLevelFilterValues.map((value) => ({
      value,
      label:
        value === NO_LEVEL_FILTER_VALUE
          ? EMPTY_ENGAGEMENT_LEVEL_LABEL
          : formatEngagementLevelLabel(value),
    })),
  },
]

const municipalityFilterDefinitionByParam = Object.fromEntries(
  municipalityFilterDefinitions.map((definition) => [definition.param, definition]),
) as Record<MunicipalityFilterParam, MunicipalityFilterDefinition>

export const getMunicipalityFilterDefinition = (
  param: MunicipalityFilterParam,
): MunicipalityFilterDefinition => municipalityFilterDefinitionByParam[param]

export type MunicipalityMultiFilterParam =
  | 'region'
  | 'slug'
  | 'advisor'
  | 'trend'
  | 'class'
  | 'level'

export const getMunicipalityMultiFilterValues = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
): string[] => {
  if (param === 'region') return state.regions ?? []
  if (param === 'slug') return state.slugs ?? []
  if (param === 'trend') return state.trends ?? []
  if (param === 'class') return state.classes ?? []
  if (param === 'level') return state.levels ?? []
  return (state.advisors ?? []).map(String)
}

const withMunicipalityListPageReset = (state: MunicipalityListState): MunicipalityListState =>
  parseMunicipalityListParams(municipalityListStateToRawParams({ ...state, page: 1 }, 1))

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

const territorialClassCount = Object.keys(territorialClassLabels).length

const isTerritorialClass = (value: string): value is MunicipalityTerritorialClass =>
  value in territorialClassLabels

const engagementLevelFilterCount = municipalityListLevelFilterValues.length

const isEngagementLevelFilterValue = (value: string): value is MunicipalityListLevelFilterValue =>
  (municipalityListLevelFilterValues as readonly string[]).includes(value)

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
  } else if (param === 'trend') {
    const trends = toggled.filter(isPoliticalTrendStatus)
    if (trends.length && trends.length < trendStatusCount) next.trends = trends
    else delete next.trends
  } else if (param === 'class') {
    const classes = toggled.filter(isTerritorialClass)
    if (classes.length && classes.length < territorialClassCount) next.classes = classes
    else delete next.classes
  } else if (param === 'level') {
    const levels = toggled.filter(isEngagementLevelFilterValue)
    if (levels.length && levels.length < engagementLevelFilterCount) next.levels = levels
    else delete next.levels
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
    case 'coverage':
      return Boolean(state.coverage)
    case 'trend':
      return Boolean(state.trends?.length)
    case 'class':
      return Boolean(state.classes?.length)
    case 'level':
      return Boolean(state.levels?.length)
  }
}

export const formatMunicipalityActiveFiltersSummary = (
  state: MunicipalityListState,
): string | null => {
  const parts: string[] = []
  if (state.priority) parts.push(municipalityPriorityLabels.alta)
  if (state.slugs?.length) {
    parts.push(
      truncatedNamesLabel(
        state.slugs.map((slug) => getMunicipalityCatalogEntry(slug)?.name ?? slug),
      ),
    )
  }
  if (state.regions?.length) parts.push(truncatedNamesLabel([...state.regions]))
  if (state.advisors?.length) {
    parts.push(state.advisors.length === 1 ? '1 assessor' : `${state.advisors.length} assessores`)
  }
  if (state.coverage) parts.push(municipalityListCoverageLabels[state.coverage])
  if (state.trends?.length) {
    parts.push(
      `Tendência ${state.trends.map((trend) => politicalTrendLabels[trend].toLowerCase()).join(', ')}`,
    )
  }
  if (state.classes?.length) {
    parts.push(
      `Classe ${state.classes.map((territorialClass) => territorialClassLabels[territorialClass].toLowerCase()).join(', ')}`,
    )
  }
  if (state.levels?.length) {
    parts.push(
      `Nível ${state.levels
        .map((level) =>
          level === NO_LEVEL_FILTER_VALUE
            ? EMPTY_ENGAGEMENT_LEVEL_LABEL.toLowerCase()
            : level.toUpperCase(),
        )
        .join(', ')}`,
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

/**
 * The href a saved filter (B18) bookmarks: the visit href minus `compare`, which
 * is the Início map's comparison lens rather than a recorte of this list, and
 * which the list's param set only carries so a hand-typed URL survives.
 */
export const buildMunicipalitySavedFilterHref = (state: MunicipalityListState): string =>
  buildMunicipalityListHref({ ...state, compare: undefined }, 1)
