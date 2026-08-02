/**
 * Municipality list omnibox adapter (B127): chips, suggestions and apply/remove
 * over the frozen URL contract + presentation scenario. Pure / client-safe.
 */
import {
  omniboxGroupMatches,
  omniboxQueryMatches,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import {
  clearMunicipalityListFilters,
  municipalityFilterDefinitions,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipality/municipalityListFilters'
import {
  municipalityListCoverageLabels,
  municipalityPriorityLabels,
} from '@/utilities/municipality/municipalityLabels'
import {
  defaultMunicipalityListSortDir,
  municipalityListSortOptions,
  resolveMunicipalityListSort,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

const DEFAULT_MUNICIPALITY_SORT_KEY = 'deficit' as const

const SUGGESTION_CAP_PER_GROUP = 8

export type MunicipalityOmniboxAction =
  | { kind: 'url'; state: MunicipalityListState }
  | { kind: 'scenario'; scenario: VoteEstimateScenario }
  | { kind: 'clear'; state: MunicipalityListState; scenario: VoteEstimateScenario }

const isDefaultMunicipalitySort = (state: MunicipalityListState): boolean => {
  const { sort, dir } = resolveMunicipalityListSort(state)
  return sort === DEFAULT_MUNICIPALITY_SORT_KEY && dir === defaultMunicipalityListSortDir(sort)
}

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

export const buildMunicipalityOmniboxChips = ({
  state,
  scenario,
  showStaffFilters,
  advisorLabelsById,
}: {
  state: MunicipalityListState
  scenario: VoteEstimateScenario
  showStaffFilters: boolean
  advisorLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (showStaffFilters && state.priority === 'alta') {
    chips.push({ id: 'priority', label: municipalityPriorityLabels.alta })
  }

  for (const slug of state.slugs ?? []) {
    chips.push({
      id: `slug:${slug}`,
      label: chipLabel('Município', getMunicipalityCatalogEntry(slug)?.name ?? slug),
    })
  }

  for (const region of state.regions ?? []) {
    chips.push({ id: `region:${region}`, label: chipLabel('Território', region) })
  }

  if (showStaffFilters) {
    for (const advisorId of state.advisors ?? []) {
      chips.push({
        id: `advisor:${advisorId}`,
        label: chipLabel('Assessor', advisorLabelsById.get(advisorId) ?? `Assessor #${advisorId}`),
      })
    }

    if (state.coverage) {
      chips.push({
        id: `coverage:${state.coverage}`,
        label: chipLabel('Assessoria', municipalityListCoverageLabels[state.coverage]),
      })
    }

    for (const trend of state.trends ?? []) {
      const definition = municipalityFilterDefinitions.find((entry) => entry.param === 'trend')
      const option = definition?.options?.find((entry) => entry.value === trend)
      chips.push({
        id: `trend:${trend}`,
        label: chipLabel('Tendência', option?.label ?? trend),
      })
    }

    for (const territorialClass of state.classes ?? []) {
      const definition = municipalityFilterDefinitions.find((entry) => entry.param === 'class')
      const option = definition?.options?.find((entry) => entry.value === territorialClass)
      chips.push({
        id: `class:${territorialClass}`,
        label: chipLabel('Classe', option?.label ?? territorialClass),
      })
    }

    for (const level of state.levels ?? []) {
      const definition = municipalityFilterDefinitions.find((entry) => entry.param === 'level')
      const option = definition?.options?.find((entry) => entry.value === level)
      chips.push({
        id: `level:${level}`,
        label: chipLabel('Nível', option?.label ?? level),
      })
    }

    if (scenario !== DEFAULT_VOTE_ESTIMATE_SCENARIO) {
      chips.push({
        id: 'scenario',
        label: chipLabel('Cenário', voteEstimateScenarioLabels[scenario]),
      })
    }
  }

  if (!isDefaultMunicipalitySort(state)) {
    const { sort, dir } = resolveMunicipalityListSort(state)
    const option = municipalityListSortOptions.find(
      (entry) => entry.key === sort && entry.dir === dir,
    )
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
  }

  return chips
}

type SuggestionSeed = CampaignListOmniboxSuggestion & {
  /** When true, show even with an empty query (dimension shortcuts). */
  emptyQueryVisible?: boolean
}

const pushMatching = (
  out: CampaignListOmniboxSuggestion[],
  seeds: readonly SuggestionSeed[],
  query: string,
): void => {
  const needle = query.trim()
  const matched: CampaignListOmniboxSuggestion[] = []
  for (const seed of seeds) {
    const { emptyQueryVisible, ...suggestion } = seed
    if (!needle) {
      if (emptyQueryVisible) matched.push(suggestion)
      continue
    }
    const groupHit = omniboxGroupMatches(suggestion.group, needle)
    const labelHit = omniboxQueryMatches(suggestion.label, needle, suggestion.keywords ?? [])
    if (groupHit || labelHit) matched.push(suggestion)
  }

  const byGroup = new Map<string, CampaignListOmniboxSuggestion[]>()
  for (const suggestion of matched) {
    const bucket = byGroup.get(suggestion.group) ?? []
    if (bucket.length >= SUGGESTION_CAP_PER_GROUP) continue
    bucket.push(suggestion)
    byGroup.set(suggestion.group, bucket)
  }
  for (const bucket of byGroup.values()) out.push(...bucket)
}

export const buildMunicipalityOmniboxSuggestions = ({
  query,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  slugFilterOptions,
}: {
  query: string
  showStaffFilters: boolean
  regionFilterOptions: readonly MunicipalityFilterOption[]
  advisorFilterOptions: readonly MunicipalityFilterOption[]
  slugFilterOptions: readonly MunicipalityFilterOption[]
}): CampaignListOmniboxSuggestion[] => {
  const suggestions: CampaignListOmniboxSuggestion[] = []
  const trimmed = query.trim()

  if (trimmed) {
    suggestions.push({
      id: `q:${trimmed}`,
      group: 'Busca',
      label: chipLabel('Busca', trimmed),
      keywords: ['busca', 'pesquisar', 'texto'],
    })
  }

  const seeds: SuggestionSeed[] = []

  if (showStaffFilters) {
    seeds.push({
      id: 'priority:alta',
      group: 'Prioritária',
      label: municipalityPriorityLabels.alta,
      keywords: ['prioritaria', 'prioridade', 'alta'],
      emptyQueryVisible: true,
    })
  }

  for (const option of slugFilterOptions) {
    seeds.push({
      id: `slug:${option.value}`,
      group: 'Município',
      label: option.label,
      keywords: ['municipio', option.value],
    })
  }

  for (const option of regionFilterOptions) {
    seeds.push({
      id: `region:${option.value}`,
      group: 'Território',
      label: option.label,
      keywords: ['territorio', 'regiao'],
      emptyQueryVisible: false,
    })
  }

  if (showStaffFilters) {
    for (const option of advisorFilterOptions) {
      seeds.push({
        id: `advisor:${option.value}`,
        group: 'Assessor',
        label: option.label,
        keywords: ['assessor', 'assessoria'],
      })
    }

    for (const [value, label] of Object.entries(municipalityListCoverageLabels)) {
      seeds.push({
        id: `coverage:${value}`,
        group: 'Assessoria',
        label,
        keywords: ['cobertura', 'assessor'],
        emptyQueryVisible: true,
      })
    }

    for (const definition of municipalityFilterDefinitions) {
      if (definition.param !== 'trend' && definition.param !== 'class' && definition.param !== 'level') {
        continue
      }
      for (const option of definition.options ?? []) {
        seeds.push({
          id: `${definition.param}:${option.value}`,
          group: definition.label,
          label: option.label,
          keywords: [definition.label.toLowerCase()],
        })
      }
    }

    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      seeds.push({
        id: `scenario:${scenario}`,
        group: 'Cenário',
        label: voteEstimateScenarioLabels[scenario],
        keywords: ['cenario', 'estimativa', 'cenário'],
        emptyQueryVisible: true,
      })
    }
  }

  for (const option of municipalityListSortOptions) {
    seeds.push({
      id: `sort:${option.key}|${option.dir}`,
      group: 'Ordenação',
      label: option.label,
      keywords: ['ordenar', 'ordenacao', 'ordem', 'sort'],
    })
  }

  // Empty focus: surface dimension shortcuts only (no 435-município dump).
  if (!trimmed) {
    for (const seed of seeds) {
      if (!seed.emptyQueryVisible) continue
      const { emptyQueryVisible: _visible, ...suggestion } = seed
      suggestions.push(suggestion)
    }
    // Always offer a few sort entry points when idle? Product: type "ordenar".
    // Keep empty focus lean — only exclusive/presentation shortcuts above.
    return suggestions
  }

  pushMatching(suggestions, seeds, trimmed)
  return suggestions
}

const withPageReset = (state: MunicipalityListState): MunicipalityListState => ({
  ...state,
  page: 1,
})

const applyMultiToggle = (
  state: MunicipalityListState,
  param: MunicipalityMultiFilterParam,
  value: string,
): MunicipalityListState => toggleMunicipalityMultiFilterValue(state, param, value)

export const applyMunicipalityOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: MunicipalityListState
  suggestionId: string
}): MunicipalityOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId === 'priority:alta') {
    return { kind: 'url', state: toggleMunicipalityPriorityFilter(state) }
  }

  if (suggestionId.startsWith('slug:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'slug', suggestionId.slice(5)) }
  }
  if (suggestionId.startsWith('region:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'region', suggestionId.slice(7)) }
  }
  if (suggestionId.startsWith('advisor:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'advisor', suggestionId.slice(8)) }
  }
  if (suggestionId.startsWith('trend:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'trend', suggestionId.slice(6)) }
  }
  if (suggestionId.startsWith('class:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'class', suggestionId.slice(6)) }
  }
  if (suggestionId.startsWith('level:')) {
    return { kind: 'url', state: applyMultiToggle(state, 'level', suggestionId.slice(6)) }
  }

  if (suggestionId.startsWith('coverage:')) {
    const value = suggestionId.slice(9)
    if (value !== 'com_assessor' && value !== 'sem_assessor') return { kind: 'url', state }
    return { kind: 'url', state: toggleMunicipalityExclusiveFilterValue(state, 'coverage', value) }
  }

  if (suggestionId.startsWith('scenario:')) {
    const scenario = suggestionId.slice(9)
    if (!(VOTE_ESTIMATE_SCENARIOS as readonly string[]).includes(scenario)) {
      return { kind: 'url', state }
    }
    return { kind: 'scenario', scenario: scenario as VoteEstimateScenario }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = municipalityListSortOptions.find(
      (entry) => entry.key === key && entry.dir === dir,
    )
    if (!option) return { kind: 'url', state }
    const next = withPageReset({ ...state, sort: option.key, dir: option.dir })
    // Canonical default omits sort/dir from the URL — clear when choosing default.
    if (isDefaultMunicipalitySort(next)) {
      return { kind: 'url', state: withPageReset({ ...state, sort: undefined, dir: undefined }) }
    }
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeMunicipalityOmniboxChip = ({
  state,
  chipId,
}: {
  state: MunicipalityListState
  chipId: string
}): MunicipalityOmniboxAction => {
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  }
  if (chipId === 'priority') {
    return { kind: 'url', state: withPageReset({ ...state, priority: undefined }) }
  }
  if (chipId === 'scenario') {
    return { kind: 'scenario', scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO }
  }
  if (chipId === 'sort') {
    return { kind: 'url', state: withPageReset({ ...state, sort: undefined, dir: undefined }) }
  }

  const multiPrefixes: Array<{ prefix: string; param: MunicipalityMultiFilterParam }> = [
    { prefix: 'slug:', param: 'slug' },
    { prefix: 'region:', param: 'region' },
    { prefix: 'advisor:', param: 'advisor' },
    { prefix: 'trend:', param: 'trend' },
    { prefix: 'class:', param: 'class' },
    { prefix: 'level:', param: 'level' },
  ]
  for (const { prefix, param } of multiPrefixes) {
    if (!chipId.startsWith(prefix)) continue
    const value = chipId.slice(prefix.length)
    // Toggle removes when present.
    return { kind: 'url', state: applyMultiToggle(state, param, value) }
  }

  if (chipId.startsWith('coverage:')) {
    return { kind: 'url', state: withPageReset({ ...state, coverage: undefined }) }
  }

  return { kind: 'url', state }
}

export const clearMunicipalityOmnibox = (state: MunicipalityListState): MunicipalityOmniboxAction => ({
  kind: 'clear',
  state: clearMunicipalityListFilters(state),
  scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
})
