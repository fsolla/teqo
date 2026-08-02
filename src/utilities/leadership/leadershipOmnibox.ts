/**
 * Leadership list omnibox adapter (B128). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  clearLeadershipListFilters,
  leadershipAccessFilterOptions,
  leadershipStatusFilterOptions,
  toggleLeadershipAccessFilter,
  toggleLeadershipMunicipalityFilter,
  toggleLeadershipStatusFilter,
  type LeadershipFilterOption,
} from '@/utilities/leadership/leadershipListFilters'
import {
  leadershipListSortLabels,
  resolveLeadershipListSort,
  type LeadershipListSortDirection,
  type LeadershipListSortKey,
  type LeadershipListState,
} from '@/utilities/leadership/leadershipListUrl'
import {
  leadershipAccessFilterLabels,
  supportStatusLabels,
} from '@/utilities/leadership/leadershipLabels'

const DEFAULT_LEADERSHIP_LIST_SORT_KEY: LeadershipListSortKey = 'updatedAt'
const DEFAULT_LEADERSHIP_LIST_SORT_DIR: LeadershipListSortDirection = 'desc'

export type LeadershipOmniboxAction =
  | { kind: 'url'; state: LeadershipListState }
  | { kind: 'clear'; state: LeadershipListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: LeadershipListState): LeadershipListState => ({ ...state, page: 1 })

const isDefaultLeadershipListSort = (state: LeadershipListState): boolean => {
  const { sort, dir } = resolveLeadershipListSort(state)
  return sort === DEFAULT_LEADERSHIP_LIST_SORT_KEY && dir === DEFAULT_LEADERSHIP_LIST_SORT_DIR
}

const leadershipListSortOptions = (
  Object.keys(leadershipListSortLabels) as LeadershipListSortKey[]
).flatMap((key) =>
  (['asc', 'desc'] as const).map((dir) => ({
    key,
    dir,
    label:
      key === 'updatedAt'
        ? dir === 'desc'
          ? 'Última atualização (mais recente)'
          : 'Última atualização (mais antigo)'
        : dir === 'asc'
          ? `${leadershipListSortLabels[key]} (A–Z)`
          : `${leadershipListSortLabels[key]} (Z–A)`,
  })),
)

export const buildLeadershipOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: LeadershipListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const status of state.statuses ?? []) {
    chips.push({ id: `status:${status}`, label: chipLabel('Status', supportStatusLabels[status]) })
  }

  for (const municipalityId of state.municipalities ?? []) {
    chips.push({
      id: `municipality:${municipalityId}`,
      label: chipLabel(
        'Município',
        municipalityLabelsById.get(municipalityId) ?? `Município #${municipalityId}`,
      ),
    })
  }

  if (state.access) {
    chips.push({
      id: `access:${state.access}`,
      label: chipLabel('Acesso ao app', leadershipAccessFilterLabels[state.access]),
    })
  }

  if (!isDefaultLeadershipListSort(state)) {
    const { sort, dir } = resolveLeadershipListSort(state)
    const option = leadershipListSortOptions.find((entry) => entry.key === sort && entry.dir === dir)
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
  }

  return chips
}

export const buildLeadershipOmniboxSuggestionSeeds = ({
  municipalityFilterOptions,
}: {
  municipalityFilterOptions: readonly LeadershipFilterOption[]
}) => {
  const seeds = []

  for (const option of leadershipStatusFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `status:${option.value}`,
          group: 'Status',
          label: option.label,
          keywords: ['status', 'situacao'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of municipalityFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: 'Município',
        label: option.label,
        keywords: ['municipio'],
      }),
    )
  }

  for (const option of leadershipAccessFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `access:${option.value}`,
          group: 'Acesso ao app',
          label: option.label,
          keywords: ['acesso', 'app', 'login'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of leadershipListSortOptions) {
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

export const filterLeadershipOmniboxSuggestions = (
  seeds: ReturnType<typeof buildLeadershipOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyLeadershipOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: LeadershipListState
  suggestionId: string
}): LeadershipOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId.startsWith('status:')) {
    return {
      kind: 'url',
      state: toggleLeadershipStatusFilter(state, suggestionId.slice(7)),
    }
  }

  if (suggestionId.startsWith('municipality:')) {
    return {
      kind: 'url',
      state: toggleLeadershipMunicipalityFilter(state, suggestionId.slice(13)),
    }
  }

  if (suggestionId.startsWith('access:')) {
    return {
      kind: 'url',
      state: toggleLeadershipAccessFilter(state, suggestionId.slice(7)),
    }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = leadershipListSortOptions.find((entry) => entry.key === key && entry.dir === dir)
    if (!option) return { kind: 'url', state }
    const next = withPageReset({ ...state, sort: option.key, dir: option.dir })
    if (isDefaultLeadershipListSort(next)) {
      return {
        kind: 'url',
        state: withPageReset({ ...state, sort: undefined, dir: undefined }),
      }
    }
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeLeadershipOmniboxChip = ({
  state,
  chipId,
}: {
  state: LeadershipListState
  chipId: string
}): LeadershipOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  if (chipId === 'sort') {
    return {
      kind: 'url',
      state: withPageReset({ ...state, sort: undefined, dir: undefined }),
    }
  }

  if (chipId.startsWith('status:')) {
    return {
      kind: 'url',
      state: toggleLeadershipStatusFilter(state, chipId.slice(7)),
    }
  }

  if (chipId.startsWith('municipality:')) {
    return {
      kind: 'url',
      state: toggleLeadershipMunicipalityFilter(state, chipId.slice(13)),
    }
  }

  if (chipId.startsWith('access:')) {
    return { kind: 'url', state: toggleLeadershipAccessFilter(state, chipId.slice(7)) }
  }

  return { kind: 'url', state }
}

export const clearLeadershipOmnibox = (state: LeadershipListState): LeadershipOmniboxAction => ({
  kind: 'clear',
  state: clearLeadershipListFilters(state),
})
