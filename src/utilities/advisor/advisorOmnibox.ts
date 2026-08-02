/**
 * Advisor list omnibox adapter (B142). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  clearAdvisorListFilters,
  toggleAdvisorMunicipalityFilter,
  type AdvisorFilterOption,
} from '@/utilities/advisor/advisorListFilters'
import type { AdvisorListState } from '@/utilities/advisor/advisorListUrl'

export type AdvisorOmniboxAction =
  | { kind: 'url'; state: AdvisorListState }
  | { kind: 'clear'; state: AdvisorListState }

const MUNICIPALITY_GROUP = 'Município (carteira)'

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: AdvisorListState): AdvisorListState => ({ ...state, page: 1 })

export const buildAdvisorOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: AdvisorListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  for (const municipalityId of state.municipalities ?? []) {
    chips.push({
      id: `municipality:${municipalityId}`,
      label: chipLabel(
        MUNICIPALITY_GROUP,
        municipalityLabelsById.get(municipalityId) ?? `Município #${municipalityId}`,
      ),
    })
  }

  return chips
}

export const buildAdvisorOmniboxSuggestionSeeds = ({
  municipalityFilterOptions,
}: {
  municipalityFilterOptions: readonly AdvisorFilterOption[]
}) => {
  const seeds = []

  for (const option of municipalityFilterOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `municipality:${option.value}`,
        group: MUNICIPALITY_GROUP,
        label: option.label,
        keywords: ['municipio', 'carteira'],
      }),
    )
  }

  return seeds
}

export const filterAdvisorOmniboxSuggestions = (
  seeds: ReturnType<typeof buildAdvisorOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyAdvisorOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: AdvisorListState
  suggestionId: string
}): AdvisorOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId.startsWith('municipality:')) {
    return {
      kind: 'url',
      state: toggleAdvisorMunicipalityFilter(state, suggestionId.slice(13)),
    }
  }

  return { kind: 'url', state }
}

export const removeAdvisorOmniboxChip = ({
  state,
  chipId,
}: {
  state: AdvisorListState
  chipId: string
}): AdvisorOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }

  if (chipId.startsWith('municipality:')) {
    return {
      kind: 'url',
      state: toggleAdvisorMunicipalityFilter(state, chipId.slice(13)),
    }
  }

  return { kind: 'url', state }
}

export const clearAdvisorOmnibox = (_state: AdvisorListState): AdvisorOmniboxAction => ({
  kind: 'clear',
  state: clearAdvisorListFilters(),
})
