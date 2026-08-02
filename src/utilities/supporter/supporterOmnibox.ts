/**
 * Supporter list omnibox adapter (B128). Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  buildSupporterListSearchParams,
  parseSupporterListParams,
  supporterSourceLabels,
  supporterVoteIntentionLabels,
  type SupporterListState,
} from '@/utilities/supporter/supporterUi'

export type SupporterFilterOption = {
  value: string
  label: string
}

export type SupporterOmniboxAction =
  | { kind: 'url'; state: SupporterListState }
  | { kind: 'clear'; state: SupporterListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: SupporterListState): SupporterListState => ({ ...state, page: 1 })

const parseStateFromParams = (
  raw: Record<string, string | string[] | undefined>,
): SupporterListState => parseSupporterListParams(raw)

export const buildSupporterOmniboxChips = ({
  state,
  municipalityLabelsById,
}: {
  state: SupporterListState
  municipalityLabelsById: ReadonlyMap<number, string>
}): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (state.voteIntention) {
    chips.push({
      id: `voteIntention:${state.voteIntention}`,
      label: chipLabel('Intenção de voto', supporterVoteIntentionLabels[state.voteIntention]),
    })
  }

  if (state.source) {
    chips.push({
      id: `source:${state.source}`,
      label: chipLabel('Fonte', supporterSourceLabels[state.source]),
    })
  }

  if (state.city) {
    chips.push({ id: `city:${state.city}`, label: chipLabel('Cidade', state.city) })
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

export const buildSupporterOmniboxSuggestionSeeds = ({
  cityOptions,
  municipalityOptions,
}: {
  cityOptions: readonly SupporterFilterOption[]
  municipalityOptions: readonly SupporterFilterOption[]
}) => {
  const seeds = []

  for (const [value, label] of Object.entries(supporterVoteIntentionLabels)) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `voteIntention:${value}`,
          group: 'Intenção de voto',
          label,
          keywords: ['intencao', 'voto'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const [value, label] of Object.entries(supporterSourceLabels)) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `source:${value}`,
          group: 'Fonte',
          label,
          keywords: ['fonte', 'origem', 'cadastro', 'import', 'importacao', 'lideranca'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const option of cityOptions) {
    seeds.push(
      createOmniboxSuggestionSeed({
        id: `city:${option.value}`,
        group: 'Cidade',
        label: option.label,
        keywords: ['cidade'],
      }),
    )
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

export const filterSupporterOmniboxSuggestions = (
  seeds: ReturnType<typeof buildSupporterOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

const setExclusiveField = (
  state: SupporterListState,
  field: 'voteIntention' | 'source' | 'city' | 'municipality',
  value: string | undefined,
): SupporterListState => {
  const params = buildSupporterListSearchParams(withPageReset(state))
  const raw: Record<string, string | string[] | undefined> = Object.fromEntries(params.entries())

  if (field === 'voteIntention') {
    raw.voteIntention = value
  } else if (field === 'source') {
    raw.source = value
  } else if (field === 'city') {
    raw.city = value
  } else {
    raw.municipality = value
  }

  return parseStateFromParams(raw)
}

export const applySupporterOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: SupporterListState
  suggestionId: string
}): SupporterOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId.startsWith('voteIntention:')) {
    const value = suggestionId.slice(14)
    const next =
      state.voteIntention === value
        ? setExclusiveField(state, 'voteIntention', undefined)
        : setExclusiveField(state, 'voteIntention', value)
    return { kind: 'url', state: next }
  }

  if (suggestionId.startsWith('source:')) {
    const value = suggestionId.slice(7)
    const next =
      state.source === value
        ? setExclusiveField(state, 'source', undefined)
        : setExclusiveField(state, 'source', value)
    return { kind: 'url', state: next }
  }

  if (suggestionId.startsWith('city:')) {
    const value = suggestionId.slice(5)
    const next =
      state.city === value
        ? setExclusiveField(state, 'city', undefined)
        : setExclusiveField(state, 'city', value)
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

export const removeSupporterOmniboxChip = ({
  state,
  chipId,
}: {
  state: SupporterListState
  chipId: string
}): SupporterOmniboxAction => {
  if (chipId === 'q') return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }

  if (chipId.startsWith('voteIntention:')) {
    return { kind: 'url', state: setExclusiveField(state, 'voteIntention', undefined) }
  }

  if (chipId.startsWith('source:')) {
    return { kind: 'url', state: setExclusiveField(state, 'source', undefined) }
  }

  if (chipId.startsWith('city:')) {
    return { kind: 'url', state: setExclusiveField(state, 'city', undefined) }
  }

  if (chipId.startsWith('municipality:')) {
    return { kind: 'url', state: setExclusiveField(state, 'municipality', undefined) }
  }

  return { kind: 'url', state }
}

export const clearSupporterOmnibox = (_state: SupporterListState): SupporterOmniboxAction => ({
  kind: 'clear',
  state: withPageReset({ page: 1 }),
})
