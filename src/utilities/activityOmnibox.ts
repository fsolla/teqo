/**
 * Activity list omnibox adapter (B128 + B138). Pure / client-safe.
 * Window presets and text search live inside the omnibox.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { activityKindLabels, activityStatusLabels } from '@/lib/schemas/activity'
import {
  activityTabLabels,
  activityTabs,
  buildActivityListSearchParams,
  parseActivityListParams,
  type ActivityListState,
  type ActivityTab,
} from '@/utilities/activityUi'

export type ActivityFilterOption = {
  value: string
  label: string
}

export type ActivityOmniboxAction =
  | { kind: 'url'; state: ActivityListState }
  | { kind: 'clear'; state: ActivityListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: ActivityListState): ActivityListState => ({ ...state, page: 1 })

const parseStateFromParams = (
  raw: Record<string, string | string[] | undefined>,
): ActivityListState => parseActivityListParams(raw)

const setExclusiveField = (
  state: ActivityListState,
  field: 'kind' | 'status' | 'municipality',
  value: string | undefined,
): ActivityListState => {
  const params = buildActivityListSearchParams(withPageReset(state))
  const raw: Record<string, string | string[] | undefined> = Object.fromEntries(params.entries())

  if (field === 'kind') {
    raw.kind = value
  } else if (field === 'status') {
    raw.status = value
  } else {
    raw.municipality = value
  }

  return parseStateFromParams(raw)
}

const tabKeywords: Record<ActivityTab, string[]> = {
  proximos: ['proximos', 'próximos', 'proximo', 'próximo'],
  todos: ['todos', 'todas'],
  realizados: ['realizados', 'realizado'],
  rascunhos: ['rascunhos', 'rascunho'],
}

const setTab = (state: ActivityListState, tab: ActivityTab): ActivityListState => {
  const params = buildActivityListSearchParams(withPageReset({ ...state, tab }))
  const raw: Record<string, string | string[] | undefined> = Object.fromEntries(params.entries())

  if (tab !== 'todos') {
    delete raw.status
  }

  return parseStateFromParams(raw)
}

export const buildActivityOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: ActivityListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (state.tab !== 'proximos') {
    chips.push({
      id: `tab:${state.tab}`,
      label: activityTabLabels[state.tab],
    })
  }

  if (state.kind) {
    chips.push({
      id: `kind:${state.kind}`,
      label: chipLabel('Tipo', activityKindLabels[state.kind]),
    })
  }

  if (state.tab === 'todos' && state.status) {
    chips.push({
      id: `status:${state.status}`,
      label: chipLabel('Status', activityStatusLabels[state.status]),
    })
  }

  if (state.municipality) {
    chips.push({
      id: `municipality:${state.municipality}`,
      label: chipLabel(
        'Município',
        municipalityLabelsById.get(state.municipality) ?? `Município #${state.municipality}`,
      ),
    })
  }

  return chips
}

export const buildActivityOmniboxSuggestionSeeds = ({
  tab,
  municipalityOptions,
}: {
  tab: ActivityTab
  municipalityOptions: readonly ActivityFilterOption[]
}) => {
  const seeds = []

  for (const tabValue of activityTabs) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `tab:${tabValue}`,
          group: 'Janela',
          label: activityTabLabels[tabValue],
          keywords: ['janela', ...tabKeywords[tabValue]],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const [value, label] of Object.entries(activityKindLabels)) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `kind:${value}`,
          group: 'Tipo',
          label,
          keywords: ['tipo', 'atividade'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  if (tab === 'todos') {
    for (const [value, label] of Object.entries(activityStatusLabels)) {
      seeds.push(
        createOmniboxSuggestionSeed(
          {
            id: `status:${value}`,
            group: 'Status',
            label,
            keywords: ['status'],
          },
          { emptyQueryVisible: true },
        ),
      )
    }
  }

  for (const option of municipalityOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: 'Município',
        label: option.label,
        keywords: ['municipio'],
      }),
    )
  }

  return seeds
}

export const filterActivityOmniboxSuggestions = (
  seeds: ReturnType<typeof buildActivityOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyActivityOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: ActivityListState
  suggestionId: string
}): ActivityOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const { trimmed } = normalizeContactSearchQuery(suggestionId.slice(2))
    const q = isContactSearchQueryReady(trimmed) ? trimmed : undefined
    return { kind: 'url', state: withPageReset({ ...state, q }) }
  }

  if (suggestionId.startsWith('tab:')) {
    const value = suggestionId.slice(4) as ActivityTab
    if (!activityTabs.includes(value)) return { kind: 'url', state }
    const next = state.tab === value ? setTab(state, 'proximos') : setTab(state, value)
    return { kind: 'url', state: next }
  }

  if (suggestionId.startsWith('kind:')) {
    const value = suggestionId.slice(5)
    const next =
      state.kind === value
        ? setExclusiveField(state, 'kind', undefined)
        : setExclusiveField(state, 'kind', value)
    return { kind: 'url', state: next }
  }

  if (suggestionId.startsWith('status:')) {
    const value = suggestionId.slice(7)
    const next =
      state.status === value
        ? setExclusiveField(state, 'status', undefined)
        : setExclusiveField(state, 'status', value)
    return { kind: 'url', state: next }
  }

  if (suggestionId.startsWith('municipality:')) {
    const value = suggestionId.slice(13)
    const next =
      state.municipality === Number(value)
        ? setExclusiveField(state, 'municipality', undefined)
        : setExclusiveField(state, 'municipality', value)
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeActivityOmniboxChip = ({
  state,
  chipId,
}: {
  state: ActivityListState
  chipId: string
}): ActivityOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }

  if (chipId.startsWith('tab:')) {
    return { kind: 'url', state: setTab(state, 'proximos') }
  }

  if (chipId.startsWith('kind:')) {
    return { kind: 'url', state: setExclusiveField(state, 'kind', undefined) }
  }

  if (chipId.startsWith('status:')) {
    return { kind: 'url', state: setExclusiveField(state, 'status', undefined) }
  }

  if (chipId.startsWith('municipality:')) {
    return { kind: 'url', state: setExclusiveField(state, 'municipality', undefined) }
  }

  return { kind: 'url', state }
}

export const clearActivityOmnibox = (state: ActivityListState): ActivityOmniboxAction => ({
  kind: 'clear',
  state: withPageReset({ page: 1, tab: state.tab }),
})
