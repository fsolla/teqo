/**
 * State deputy ("dobradinha") list omnibox adapter (B128). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/campaignListUrl'
import {
  buildStateDeputyPartyOptions,
  clearStateDeputyListFilters,
  toggleStateDeputyPartyFilter,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {
  resolveStateDeputyListSort,
  stateDeputyListSortOptions,
  type StateDeputyListSortDirection,
  type StateDeputyListSortKey,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

const DEFAULT_STATE_DEPUTY_LIST_SORT_KEY: StateDeputyListSortKey = 'name'
const DEFAULT_STATE_DEPUTY_LIST_SORT_DIR: StateDeputyListSortDirection = 'asc'

const noPartyFilterLabel = 'Sem partido'

export type StateDeputyOmniboxAction =
  | { kind: 'url'; state: StateDeputyListState }
  | { kind: 'clear'; state: StateDeputyListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: StateDeputyListState): StateDeputyListState => ({ ...state, page: 1 })

const isDefaultStateDeputyListSort = (state: StateDeputyListState): boolean => {
  const { sort, dir } = resolveStateDeputyListSort(state)
  return sort === DEFAULT_STATE_DEPUTY_LIST_SORT_KEY && dir === DEFAULT_STATE_DEPUTY_LIST_SORT_DIR
}

const partyChipLabel = (party: string): string =>
  party === NO_PARTY_FILTER_VALUE ? noPartyFilterLabel : party

export const buildStateDeputyOmniboxChips = (
  state: StateDeputyListState,
): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const party of state.parties ?? []) {
    chips.push({ id: `party:${party}`, label: chipLabel('Partido', partyChipLabel(party)) })
  }

  if (!isDefaultStateDeputyListSort(state)) {
    const { sort, dir } = resolveStateDeputyListSort(state)
    const option = stateDeputyListSortOptions.find(
      (entry) => entry.key === sort && entry.dir === dir,
    )
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
  }

  return chips
}

export const buildStateDeputyOmniboxSuggestionSeeds = ({
  partyOptions,
  hasNoParty,
}: {
  partyOptions: readonly StateDeputyFilterOption[]
  hasNoParty: boolean
}) => {
  const seeds = []

  for (const option of buildStateDeputyPartyOptions(partyOptions, hasNoParty)) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `party:${option.value}`,
        group: 'Partido',
        label: option.label,
        keywords: ['partido'],
      }),
    )
  }

  for (const option of stateDeputyListSortOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `sort:${option.key}|${option.dir}`,
        group: 'Ordenação',
        label: option.label,
        keywords: ['ordenar', 'ordenacao', 'ordem', 'sort'],
      }),
    )
  }

  return seeds
}

export const filterStateDeputyOmniboxSuggestions = (
  seeds: ReturnType<typeof buildStateDeputyOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyStateDeputyOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: StateDeputyListState
  suggestionId: string
}): StateDeputyOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId.startsWith('party:')) {
    return {
      kind: 'url',
      state: toggleStateDeputyPartyFilter(state, suggestionId.slice(6)),
    }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = stateDeputyListSortOptions.find(
      (entry) => entry.key === key && entry.dir === dir,
    )
    if (!option) return { kind: 'url', state }
    const next = withPageReset({ ...state, sort: option.key, dir: option.dir })
    if (isDefaultStateDeputyListSort(next)) {
      return {
        kind: 'url',
        state: withPageReset({ ...state, sort: undefined, dir: undefined }),
      }
    }
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeStateDeputyOmniboxChip = ({
  state,
  chipId,
}: {
  state: StateDeputyListState
  chipId: string
}): StateDeputyOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  if (chipId === 'sort') {
    return {
      kind: 'url',
      state: withPageReset({ ...state, sort: undefined, dir: undefined }),
    }
  }

  if (chipId.startsWith('party:')) {
    return {
      kind: 'url',
      state: toggleStateDeputyPartyFilter(state, chipId.slice(6)),
    }
  }

  return { kind: 'url', state }
}

export const clearStateDeputyOmnibox = (state: StateDeputyListState): StateDeputyOmniboxAction => ({
  kind: 'clear',
  state: clearStateDeputyListFilters(state),
})
