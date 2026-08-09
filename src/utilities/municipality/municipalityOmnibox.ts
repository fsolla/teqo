/**
 * Municipality list omnibox adapter (B127): chips, suggestions and apply/remove
 * over the frozen URL contract + presentation scenario. Pure / client-safe.
 */
import {
  omniboxGroupMatches,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { municipalityDisplayNameForSlug } from '@/lib/salvadorCity'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/campaignListUrl'
import {
  municipalityListCoverageLabels,
  municipalityPriorityLabels,
} from '@/utilities/municipality/municipalityLabels'
import {
  clearMunicipalityListFilters,
  getMunicipalityFilterDefinition,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipality/municipalityListFilters'
import {
  isDefaultMunicipalityListSort,
  municipalityListSortOptions,
  NO_LEADERSHIP_FILTER_VALUE,
  NO_STATE_DEPUTY_FILTER_VALUE,
  resolveMunicipalityListSort,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

const SUGGESTION_CAP_PER_GROUP = 8

export type MunicipalityOmniboxAction =
  | { kind: 'url'; state: MunicipalityListState }
  | { kind: 'scenario'; scenario: VoteEstimateScenario }
  | { kind: 'clear'; state: MunicipalityListState; scenario: VoteEstimateScenario }

type SuggestionSeed = CampaignListOmniboxSuggestion & {
  /** When true, show even with an empty query (dimension shortcuts). */
  emptyQueryVisible?: boolean
  normalizedLabel: string
  normalizedKeywords: readonly string[]
}

const MULTI_PREFIXES: Array<{ prefix: string; param: MunicipalityMultiFilterParam }> = [
  { prefix: 'slug:', param: 'slug' },
  { prefix: 'region:', param: 'region' },
  { prefix: 'advisor:', param: 'advisor' },
  { prefix: 'trend:', param: 'trend' },
  { prefix: 'class:', param: 'class' },
  { prefix: 'level:', param: 'level' },
  { prefix: 'stateDeputy:', param: 'stateDeputy' },
  { prefix: 'leadership:', param: 'leadership' },
  { prefix: 'party:', param: 'party' },
]

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const labelForFilterValue = (param: 'trend' | 'class' | 'level', value: string): string =>
  getMunicipalityFilterDefinition(param).options?.find((option) => option.value === value)?.label ??
  value

const withPageReset = (state: MunicipalityListState): MunicipalityListState => ({
  ...state,
  page: 1,
})

const seedOf = (
  suggestion: CampaignListOmniboxSuggestion,
  extras?: { emptyQueryVisible?: boolean },
): SuggestionSeed => ({
  ...suggestion,
  ...extras,
  normalizedLabel: normalizeSearchPhrase(suggestion.label),
  normalizedKeywords: (suggestion.keywords ?? []).map((keyword) => normalizeSearchPhrase(keyword)),
})

export const buildMunicipalityOmniboxChips = ({
  state,
  scenario,
  showStaffFilters,
  advisorLabelsById,
  stateDeputyLabelsById,
  leadershipLabelsById,
}: {
  state: MunicipalityListState
  scenario: VoteEstimateScenario
  showStaffFilters: boolean
  advisorLabelsById: ReadonlyMap<number, string>
  stateDeputyLabelsById: ReadonlyMap<number, string>
  leadershipLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (showStaffFilters && state.priority === 'alta') {
    chips.push({ id: 'priority', label: municipalityPriorityLabels.alta })
  }

  for (const slug of state.slugs ?? []) {
    chips.push({
      id: `slug:${slug}`,
      label: chipLabel('Município', municipalityDisplayNameForSlug(slug) ?? slug),
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
      chips.push({
        id: `trend:${trend}`,
        label: chipLabel('Tendência', labelForFilterValue('trend', trend)),
      })
    }

    for (const territorialClass of state.classes ?? []) {
      chips.push({
        id: `class:${territorialClass}`,
        label: chipLabel('Classe', labelForFilterValue('class', territorialClass)),
      })
    }

    for (const level of state.levels ?? []) {
      chips.push({
        id: `level:${level}`,
        label: chipLabel('Nível', labelForFilterValue('level', level)),
      })
    }

    for (const stateDeputy of state.stateDeputies ?? []) {
      chips.push({
        id: `stateDeputy:${stateDeputy}`,
        label:
          stateDeputy === NO_STATE_DEPUTY_FILTER_VALUE
            ? 'Dobradinha: Sem dobradinha'
            : chipLabel(
                'Dobradinha',
                stateDeputyLabelsById.get(stateDeputy) ?? `Dobradinha #${stateDeputy}`,
              ),
      })
    }

    for (const leadership of state.leaderships ?? []) {
      chips.push({
        id: `leadership:${leadership}`,
        label:
          leadership === NO_LEADERSHIP_FILTER_VALUE
            ? 'Liderança: Sem liderança'
            : chipLabel(
                'Liderança',
                leadershipLabelsById.get(leadership) ?? `Liderança #${leadership}`,
              ),
      })
    }

    for (const party of state.parties ?? []) {
      chips.push({
        id: `party:${party}`,
        label:
          party === NO_PARTY_FILTER_VALUE ? 'Partido: Sem partido' : chipLabel('Partido', party),
      })
    }

    if (scenario !== DEFAULT_VOTE_ESTIMATE_SCENARIO) {
      chips.push({
        id: 'scenario',
        label: chipLabel('Cenário', voteEstimateScenarioLabels[scenario]),
      })
    }
  }

  if (!isDefaultMunicipalityListSort(state)) {
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

/** Stable suggestion catalog for a facet snapshot — memoize across keystrokes. */
export const buildMunicipalityOmniboxSuggestionSeeds = ({
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  slugFilterOptions,
  stateDeputyFilterOptions,
  leadershipFilterOptions,
  partyFilterOptions,
}: {
  showStaffFilters: boolean
  regionFilterOptions: readonly MunicipalityFilterOption[]
  advisorFilterOptions: readonly MunicipalityFilterOption[]
  slugFilterOptions: readonly MunicipalityFilterOption[]
  stateDeputyFilterOptions: readonly MunicipalityFilterOption[]
  leadershipFilterOptions: readonly MunicipalityFilterOption[]
  partyFilterOptions: readonly MunicipalityFilterOption[]
}): SuggestionSeed[] => {
  const seeds: SuggestionSeed[] = []

  if (showStaffFilters) {
    seeds.push(
      seedOf(
        {
          id: 'priority:alta',
          group: 'Prioritária',
          label: municipalityPriorityLabels.alta,
          keywords: ['prioritaria', 'prioridade', 'alta'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of slugFilterOptions) {
    seeds.push(
      seedOf({
        id: `slug:${option.value}`,
        group: 'Município',
        label: option.label,
        keywords: ['municipio', option.value],
      }),
    )
  }

  for (const option of regionFilterOptions) {
    seeds.push(
      seedOf({
        id: `region:${option.value}`,
        group: 'Território',
        label: option.label,
        keywords: ['territorio', 'regiao'],
      }),
    )
  }

  if (showStaffFilters) {
    for (const option of advisorFilterOptions) {
      seeds.push(
        seedOf({
          id: `advisor:${option.value}`,
          group: 'Assessor',
          label: option.label,
          keywords: ['assessor', 'assessoria'],
        }),
      )
    }

    for (const option of stateDeputyFilterOptions) {
      seeds.push(
        seedOf({
          id: `stateDeputy:${option.value}`,
          group: 'Dobradinha',
          label: option.label,
          keywords: ['dobradinha', 'deputado', 'deputada'],
        }),
      )
    }

    // "Sem dobradinha" is the triage of this dimension — same static seed as
    // "Sem nível" (revealed while typing, never `emptyQueryVisible`).
    seeds.push(
      seedOf({
        id: `stateDeputy:${NO_STATE_DEPUTY_FILTER_VALUE}`,
        group: 'Dobradinha',
        label: 'Sem dobradinha',
        keywords: ['sem', 'dobradinha'],
      }),
    )

    for (const option of leadershipFilterOptions) {
      seeds.push(
        seedOf({
          id: `leadership:${option.value}`,
          group: 'Liderança',
          label: option.label,
          keywords: ['lideranca', 'lider', 'liderança'],
        }),
      )
    }

    seeds.push(
      seedOf({
        id: `leadership:${NO_LEADERSHIP_FILTER_VALUE}`,
        group: 'Liderança',
        label: 'Sem liderança',
        keywords: ['sem', 'lideranca', 'lider', 'liderança'],
      }),
    )

    for (const option of partyFilterOptions) {
      seeds.push(
        seedOf({
          id: `party:${option.value}`,
          group: 'Partido',
          label: option.label,
          keywords: ['partido', 'sigla', option.value],
        }),
      )
    }

    seeds.push(
      seedOf({
        id: `party:${NO_PARTY_FILTER_VALUE}`,
        group: 'Partido',
        label: 'Sem partido',
        keywords: ['sem', 'partido'],
      }),
    )

    for (const [value, label] of Object.entries(municipalityListCoverageLabels)) {
      seeds.push(
        seedOf(
          {
            id: `coverage:${value}`,
            group: 'Assessoria',
            label,
            keywords: ['cobertura', 'assessor'],
          },
          { emptyQueryVisible: true },
        ),
      )
    }

    for (const param of ['trend', 'class', 'level'] as const) {
      const definition = getMunicipalityFilterDefinition(param)
      for (const option of definition.options ?? []) {
        seeds.push(
          seedOf({
            id: `${param}:${option.value}`,
            group: definition.label,
            label: option.label,
            keywords: [definition.label.toLowerCase()],
          }),
        )
      }
    }

    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      seeds.push(
        seedOf(
          {
            id: `scenario:${scenario}`,
            group: 'Cenário',
            label: voteEstimateScenarioLabels[scenario],
            keywords: ['cenario', 'estimativa', 'cenário'],
          },
          { emptyQueryVisible: true },
        ),
      )
    }
  }

  for (const option of municipalityListSortOptions) {
    seeds.push(
      seedOf({
        id: `sort:${option.key}|${option.dir}`,
        group: 'Ordenação',
        label: option.label,
        keywords: ['ordenar', 'ordenacao', 'ordem', 'sort'],
      }),
    )
  }

  return seeds
}

export const filterMunicipalityOmniboxSuggestions = (
  seeds: readonly SuggestionSeed[],
  query: string,
): CampaignListOmniboxSuggestion[] => {
  const suggestions: CampaignListOmniboxSuggestion[] = []
  const trimmed = query.trim()
  const normalizedNeedle = normalizeSearchPhrase(trimmed)

  if (trimmed) {
    suggestions.push({
      id: `q:${trimmed}`,
      group: 'Busca',
      label: chipLabel('Busca', trimmed),
      keywords: ['busca', 'pesquisar', 'texto'],
    })
  }

  const groupCounts = new Map<string, number>()

  for (const seed of seeds) {
    const count = groupCounts.get(seed.group) ?? 0
    if (count >= SUGGESTION_CAP_PER_GROUP) continue

    if (!normalizedNeedle) {
      if (!seed.emptyQueryVisible) continue
    } else {
      const groupHit = omniboxGroupMatches(seed.group, trimmed)
      const labelHit =
        seed.normalizedLabel.includes(normalizedNeedle) ||
        seed.normalizedKeywords.some((keyword) => keyword.includes(normalizedNeedle))
      if (!groupHit && !labelHit) continue
    }

    const {
      emptyQueryVisible: _visible,
      normalizedLabel: _label,
      normalizedKeywords: _kw,
      ...suggestion
    } = seed
    suggestions.push(suggestion)
    groupCounts.set(seed.group, count + 1)
  }

  return suggestions
}

/** Convenience for one-shot callers (tests); UI memoizes seeds + filters. */
export const buildMunicipalityOmniboxSuggestions = ({
  query,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  slugFilterOptions,
  stateDeputyFilterOptions,
  leadershipFilterOptions,
  partyFilterOptions,
}: {
  query: string
  showStaffFilters: boolean
  regionFilterOptions: readonly MunicipalityFilterOption[]
  advisorFilterOptions: readonly MunicipalityFilterOption[]
  slugFilterOptions: readonly MunicipalityFilterOption[]
  stateDeputyFilterOptions: readonly MunicipalityFilterOption[]
  leadershipFilterOptions: readonly MunicipalityFilterOption[]
  partyFilterOptions: readonly MunicipalityFilterOption[]
}): CampaignListOmniboxSuggestion[] =>
  filterMunicipalityOmniboxSuggestions(
    buildMunicipalityOmniboxSuggestionSeeds({
      showStaffFilters,
      regionFilterOptions,
      advisorFilterOptions,
      slugFilterOptions,
      stateDeputyFilterOptions,
      leadershipFilterOptions,
      partyFilterOptions,
    }),
    query,
  )

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

  for (const { prefix, param } of MULTI_PREFIXES) {
    if (!suggestionId.startsWith(prefix)) continue
    return {
      kind: 'url',
      state: toggleMunicipalityMultiFilterValue(state, param, suggestionId.slice(prefix.length)),
    }
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
    if (isDefaultMunicipalityListSort(next)) {
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

  for (const { prefix, param } of MULTI_PREFIXES) {
    if (!chipId.startsWith(prefix)) continue
    return {
      kind: 'url',
      state: toggleMunicipalityMultiFilterValue(state, param, chipId.slice(prefix.length)),
    }
  }

  if (chipId.startsWith('coverage:')) {
    return { kind: 'url', state: withPageReset({ ...state, coverage: undefined }) }
  }

  return { kind: 'url', state }
}

export const clearMunicipalityOmnibox = (
  state: MunicipalityListState,
): MunicipalityOmniboxAction => ({
  kind: 'clear',
  state: clearMunicipalityListFilters(state),
  scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
})
