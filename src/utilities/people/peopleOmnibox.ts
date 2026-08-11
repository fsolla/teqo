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
  peopleAbsenceFilterOptions,
  peopleCapacityFilterOptions,
  peopleStatusFilterOptions,
  togglePeopleAbsenceFilter,
  togglePeopleCapacityFilter,
  togglePeopleMunicipalityFilter,
  togglePeopleStatusFilter,
  type PeopleFilterOption,
} from '@/utilities/people/peopleListFilters'
import {
  isDefaultPeopleListSort,
  peopleAbsenceLabels,
  peopleListSortOptions,
  resolvePeopleListSort,
  type PeopleListState,
} from '@/utilities/people/peopleListUrl'

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

  for (const ausencia of state.ausencias ?? []) {
    chips.push({
      id: `ausencia:${ausencia}`,
      label: chipLabel('Ausência', peopleAbsenceLabels[ausencia]),
    })
  }

  if (!isDefaultPeopleListSort(state)) {
    const { sort, dir } = resolvePeopleListSort(state)
    const option = peopleListSortOptions.find((entry) => entry.key === sort && entry.dir === dir)
    chips.push({
      id: 'sort',
      label: chipLabel('Ordenação', option?.label ?? `${sort} ${dir}`),
    })
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

  for (const option of peopleAbsenceFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `ausencia:${option.value}`,
          group: 'Ausência',
          label: option.label,
          keywords: ['sem', 'ausencia', 'faltando', 'faltante', 'vazio'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of peopleListSortOptions) {
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

  if (suggestionId.startsWith('ausencia:')) {
    return { kind: 'url', state: togglePeopleAbsenceFilter(state, suggestionId.slice(9)) }
  }

  if (suggestionId.startsWith('sort:')) {
    const raw = suggestionId.slice(5)
    const [key, dir] = raw.split('|')
    const option = peopleListSortOptions.find((entry) => entry.key === key && entry.dir === dir)
    if (!option) return { kind: 'url', state }
    const next = { ...state, page: 1, sort: option.key, dir: option.dir }
    if (isDefaultPeopleListSort(next)) {
      return { kind: 'url', state: { ...state, page: 1, sort: undefined, dir: undefined } }
    }
    return { kind: 'url', state: next }
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

  if (chipId.startsWith('ausencia:')) {
    return { kind: 'url', state: togglePeopleAbsenceFilter(state, chipId.slice(9)) }
  }

  if (chipId === 'sort') {
    return { kind: 'url', state: { ...state, page: 1, sort: undefined, dir: undefined } }
  }

  return { kind: 'url', state }
}

export const clearPeopleOmnibox = (state: PeopleListState): PeopleOmniboxAction => ({
  kind: 'clear',
  state: clearPeopleListFilters(state),
})
