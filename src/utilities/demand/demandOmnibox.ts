/**
 * Demand list omnibox adapter (B128). Status-only; kind/activity deep-links
 * stay URL-only without new list UI. Pure / client-safe.
 */
import {
  campaignDemandStatusLabels,
  campaignDemandStatuses,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import type { DemandListState } from '@/utilities/demand/demandListUrl'

export type { DemandListState }

export type DemandOmniboxAction =
  | { kind: 'url'; state: DemandListState }
  | { kind: 'clear'; state: DemandListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: DemandListState): DemandListState => ({ ...state, page: 1 })

export const buildDemandOmniboxChips = (state: DemandListState): CampaignListOmniboxChip[] => {
  if (!state.status) return []
  return [
    {
      id: `status:${state.status}`,
      label: chipLabel('Status', campaignDemandStatusLabels[state.status]),
    },
  ]
}

export const buildDemandOmniboxSuggestionSeeds = () =>
  campaignDemandStatuses.map((status) =>
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
  if (chipId.startsWith('status:')) {
    return { kind: 'url', state: withPageReset({ ...state, status: undefined }) }
  }
  return { kind: 'url', state }
}

export const clearDemandOmnibox = (state: DemandListState): DemandOmniboxAction => ({
  kind: 'clear',
  state: withPageReset({
    page: 1,
    ...(state.kind ? { kind: state.kind } : {}),
    ...(state.activityId ? { activityId: state.activityId } : {}),
  }),
})
