/**
 * Demand list omnibox adapter (B128 + B140). Status, kind and free-text search;
 * activity deep-links stay URL-only without list UI. Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  campaignDemandKindLabels,
  campaignDemandKinds,
  campaignDemandStatusLabels,
  campaignDemandStatuses,
  type CampaignDemandKind,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import type { DemandListState } from '@/utilities/demand/demandListUrl'

export type { DemandListState }

export type DemandOmniboxAction =
  | { kind: 'url'; state: DemandListState }
  | { kind: 'clear'; state: DemandListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: DemandListState): DemandListState => ({ ...state, page: 1 })

export const buildDemandOmniboxChips = (state: DemandListState): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (state.kind) {
    chips.push({
      id: `kind:${state.kind}`,
      label: chipLabel('Tipo', campaignDemandKindLabels[state.kind]),
    })
  }

  if (state.status) {
    chips.push({
      id: `status:${state.status}`,
      label: chipLabel('Status', campaignDemandStatusLabels[state.status]),
    })
  }

  return chips
}

export const buildDemandOmniboxSuggestionSeeds = () => {
  const seeds = []

  for (const kind of campaignDemandKinds) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `kind:${kind}`,
          group: 'Tipo',
          label: campaignDemandKindLabels[kind],
          keywords: ['tipo', 'demanda'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  for (const status of campaignDemandStatuses) {
    seeds.push(
      createOmniboxSuggestionSeed(
        {
          id: `status:${status}`,
          group: 'Status',
          label: campaignDemandStatusLabels[status],
          keywords: ['status', 'situacao'],
        },
        { emptyQueryVisible: true },
      ),
    )
  }

  return seeds
}

export const filterDemandOmniboxSuggestions = (
  seeds: ReturnType<typeof buildDemandOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyDemandOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: DemandListState
  suggestionId: string
}): DemandOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (suggestionId.startsWith('kind:')) {
    const value = suggestionId.slice(5)
    if (!campaignDemandKinds.includes(value as CampaignDemandKind)) {
      return { kind: 'url', state }
    }
    const kind = value as CampaignDemandKind
    return {
      kind: 'url',
      state: withPageReset({
        ...state,
        kind: state.kind === kind ? undefined : kind,
      }),
    }
  }

  if (!suggestionId.startsWith('status:')) return { kind: 'url', state }

  const value = suggestionId.slice(7)
  if (!campaignDemandStatuses.includes(value as CampaignDemandStatus)) {
    return { kind: 'url', state }
  }

  const status = value as CampaignDemandStatus
  return {
    kind: 'url',
    state: withPageReset({
      ...state,
      status: state.status === status ? undefined : status,
    }),
  }
}

export const removeDemandOmniboxChip = ({
  state,
  chipId,
}: {
  state: DemandListState
  chipId: string
}): DemandOmniboxAction => {
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  }
  if (chipId.startsWith('kind:')) {
    return { kind: 'url', state: withPageReset({ ...state, kind: undefined }) }
  }
  if (chipId.startsWith('status:')) {
    return { kind: 'url', state: withPageReset({ ...state, status: undefined }) }
  }
  return { kind: 'url', state }
}

export const clearDemandOmnibox = (state: DemandListState): DemandOmniboxAction => ({
  kind: 'clear',
  state: withPageReset({
    page: 1,
    ...(state.activityId ? { activityId: state.activityId } : {}),
  }),
})
