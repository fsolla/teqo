/**
 * Territory list omnibox adapter (B128). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  clearTerritoryListFilters,
  territoryCoverageLabels,
  toggleTerritoryCoverageFilter,
  toggleTerritoryRegionFilter,
  type TerritoryFilterOption,
} from '@/utilities/territory/territoryListFilters'
import {
  resolveTerritoryListSort,
  territoryListSortOptions,
  type TerritoryListSortDirection,
  type TerritoryListSortKey,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'

const DEFAULT_TERRITORY_LIST_SORT_KEY: TerritoryListSortKey = 'pct'
const DEFAULT_TERRITORY_LIST_SORT_DIR: TerritoryListSortDirection = 'desc'

export type TerritoryOmniboxAction =
  | { kind: 'url'; state: TerritoryListState }
  | { kind: 'clear'; state: TerritoryListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const isDefaultTerritoryListSort = (state: TerritoryListState): boolean => {
  const { sort, dir } = resolveTerritoryListSort(state)
  return sort === DEFAULT_TERRITORY_LIST_SORT_KEY && dir === DEFAULT_TERRITORY_LIST_SORT_DIR
}

export const buildTerritoryOmniboxChips = (state: TerritoryListState): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const region of state.regions ?? []) {
    chips.push({ id: `region:${region}`, label: chipLabel('Território', region) })
  }

  if (state.coverage) {
    chips.push({
      id: `coverage:${state.coverage}`,
      label: chipLabel('Assessoria', territoryCoverageLabels[state.coverage]),
    })
  }

  if (!isDefaultTerritoryListSort(state)) {
    const { sort, dir } = resolveTerritoryListSort(state)
    const option = territoryListSortOptions.find((entry) => entry.key === sort && entry.dir === dir)
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
  }

  return chips
}

export const buildTerritoryOmniboxSuggestionSeeds = (
  regionOptions: readonly TerritoryFilterOption[],
) => {
  const seeds = []

  for (const option of regionOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `region:${option.value}`,
        group: 'Território',
        label: option.label,
        keywords: ['territorio', 'regiao'],
      }),
    )
  }

  for (const [value, label] of Object.entries(territoryCoverageLabels)) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `coverage:${value}`,
          group: 'Assessoria',
          label,
          keywords: ['cobertura', 'assessor', 'assessoria'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of territoryListSortOptions) {
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

export const filterTerritoryOmniboxSuggestions = (
  seeds: ReturnType<typeof buildTerritoryOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyTerritoryOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: TerritoryListState
  suggestionId: string
}): TerritoryOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: { ...state, q: q || undefined } }
  }

  if (suggestionId.startsWith('region:')) {
    return {
      kind: 'url',
      state: toggleTerritoryRegionFilter(state, suggestionId.slice(7)),
    }
  }

  if (suggestionId.startsWith('coverage:')) {
    const value = suggestionId.slice(9)
    if (value !== 'com_assessor' && value !== 'sem_assessor') return { kind: 'url', state }
    return { kind: 'url', state: toggleTerritoryCoverageFilter(state, value) }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = territoryListSortOptions.find((entry) => entry.key === key && entry.dir === dir)
    if (!option) return { kind: 'url', state }
    const next = { ...state, sort: option.key, dir: option.dir }
    if (isDefaultTerritoryListSort(next)) {
      return { kind: 'url', state: { ...state, sort: undefined, dir: undefined } }
    }
    return { kind: 'url', state: next }
  }

  return { kind: 'url', state }
}

export const removeTerritoryOmniboxChip = ({
  state,
  chipId,
}: {
  state: TerritoryListState
  chipId: string
}): TerritoryOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: { ...state, q: undefined } }
  if (chipId === 'sort') return { kind: 'url', state: { ...state, sort: undefined, dir: undefined } }

  if (chipId.startsWith('region:')) {
    return {
      kind: 'url',
      state: toggleTerritoryRegionFilter(state, chipId.slice(7)),
    }
  }

  if (chipId.startsWith('coverage:')) {
    return { kind: 'url', state: { ...state, coverage: undefined } }
  }

  return { kind: 'url', state }
}

export const clearTerritoryOmnibox = (state: TerritoryListState): TerritoryOmniboxAction => ({
  kind: 'clear',
  state: clearTerritoryListFilters(state),
})
