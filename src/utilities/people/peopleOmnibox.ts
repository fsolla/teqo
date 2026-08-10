/**
 * People list omnibox adapter (C100). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'
import { peopleCapacityLabels } from '@/utilities/people/peopleLabels'
import {
  clearPeopleListFilters,
  peopleCapacityFilterOptions,
  peopleStatusFilterOptions,
  togglePeopleCapacityFilter,
  togglePeopleMunicipalityFilter,
  togglePeopleStatusFilter,
  type PeopleFilterOption,
} from '@/utilities/people/peopleListFilters'
import type { PeopleListState } from '@/utilities/people/peopleListUrl'

export type PeopleOmniboxAction =
  | { kind: 'url'; state: PeopleListState }
  | { kind: 'clear'; state: PeopleListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

export const buildPeopleOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: PeopleListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const capacity of state.capacities ?? []) {
    chips.push({
      id: `capacity:${capacity}`,
      label: chipLabel('Capacidade', peopleCapacityLabels[capacity]),
    })
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

  for (const status of state.statuses ?? []) {
    chips.push({ id: `status:${status}`, label: chipLabel('Apoio', supportStatusLabels[status]) })
  }

  return chips
}

export const buildPeopleOmniboxSuggestionSeeds = ({
  municipalityFilterOptions,
}: {
  municipalityFilterOptions: readonly PeopleFilterOption[]
}) => {
  const seeds = []

  for (const option of peopleCapacityFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `capacity:${option.value}`,
          group: 'Capacidade',
          label: option.label,
          keywords: ['capacidade', 'papel', 'assessora', 'lideranca', 'dobradinha'],
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

  for (const option of peopleStatusFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `status:${option.value}`,
          group: 'Apoio',
          label: option.label,
          keywords: ['apoio', 'status', 'situacao'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  return seeds
}

export const filterPeopleOmniboxSuggestions = (
  seeds: ReturnType<typeof buildPeopleOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyPeopleOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: PeopleListState
  suggestionId: string
}): PeopleOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: { ...state, page: 1, q: q || undefined } }
  }

  if (suggestionId.startsWith('capacity:')) {
    return { kind: 'url', state: togglePeopleCapacityFilter(state, suggestionId.slice(9)) }
  }

  if (suggestionId.startsWith('municipality:')) {
    return { kind: 'url', state: togglePeopleMunicipalityFilter(state, suggestionId.slice(13)) }
  }

  if (suggestionId.startsWith('status:')) {
    return { kind: 'url', state: togglePeopleStatusFilter(state, suggestionId.slice(7)) }
  }

  return { kind: 'url', state }
}

export const removePeopleOmniboxChip = ({
  state,
  chipId,
}: {
  state: PeopleListState
  chipId: string
}): PeopleOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: { ...state, page: 1, q: undefined } }

  if (chipId.startsWith('capacity:')) {
    return { kind: 'url', state: togglePeopleCapacityFilter(state, chipId.slice(9)) }
  }

  if (chipId.startsWith('municipality:')) {
    return { kind: 'url', state: togglePeopleMunicipalityFilter(state, chipId.slice(13)) }
  }

  if (chipId.startsWith('status:')) {
    return { kind: 'url', state: togglePeopleStatusFilter(state, chipId.slice(7)) }
  }

  return { kind: 'url', state }
}

export const clearPeopleOmnibox = (): PeopleOmniboxAction => ({
  kind: 'clear',
  state: clearPeopleListFilters(),
})
