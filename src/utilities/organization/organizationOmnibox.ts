/**
 * Organization list omnibox adapter (B139). Search + exclusive kind filter.
 * Pure / client-safe.
 */
import {
  createOmniboxSuggestionSeed,
  filterOmniboxSuggestionSeeds,
  type CampaignListOmniboxChip,
  type CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import {
  organizationKindLabels,
  organizationKinds,
  type OrganizationKind,
} from '@/lib/schemas/organization'
import type { OrganizationListState } from '@/utilities/organization/organizationListUrl'

export type OrganizationOmniboxAction =
  | { kind: 'url'; state: OrganizationListState }
  | { kind: 'clear'; state: OrganizationListState }

const chipLabel = (dimension: string, value: string): string => `${dimension}: ${value}`

const withPageReset = (state: OrganizationListState): OrganizationListState => ({
  ...state,
  page: 1,
})

export const buildOrganizationOmniboxChips = (
  state: OrganizationListState,
): CampaignListOmniboxChip[] => {
  const chips: CampaignListOmniboxChip[] = []

  if (state.q) chips.push({ id: 'q', label: chipLabel('Busca', state.q) })

  if (state.kind) {
    chips.push({
      id: `kind:${state.kind}`,
      label: chipLabel('Tipo', organizationKindLabels[state.kind]),
    })
  }

  return chips
}

export const buildOrganizationOmniboxSuggestionSeeds = () =>
  organizationKinds.map((kind) =>
    createOmniboxSuggestionSeed(
      {
        id: `kind:${kind}`,
        group: 'Tipo',
        label: organizationKindLabels[kind],
        keywords: ['tipo', 'organizacao'],
      },
      { emptyQueryVisible: true },
    ),
  )

export const filterOrganizationOmniboxSuggestions = (
  seeds: ReturnType<typeof buildOrganizationOmniboxSuggestionSeeds>,
  query: string,
): CampaignListOmniboxSuggestion[] => filterOmniboxSuggestionSeeds(seeds, query)

export const applyOrganizationOmniboxSuggestion = ({
  state,
  suggestionId,
}: {
  state: OrganizationListState
  suggestionId: string
}): OrganizationOmniboxAction => {
  if (suggestionId.startsWith('q:')) {
    const q = suggestionId.slice(2)
    return { kind: 'url', state: withPageReset({ ...state, q: q || undefined }) }
  }

  if (!suggestionId.startsWith('kind:')) return { kind: 'url', state }

  const value = suggestionId.slice(5)
  if (!organizationKinds.includes(value as OrganizationKind)) {
    return { kind: 'url', state }
  }

  const kind = value as OrganizationKind
  return {
    kind: 'url',
    state: withPageReset({
      ...state,
      kind: state.kind === kind ? undefined : kind,
    }),
  }
}

export const removeOrganizationOmniboxChip = ({
  state,
  chipId,
}: {
  state: OrganizationListState
  chipId: string
}): OrganizationOmniboxAction => {
  if (chipId === 'q') {
    return { kind: 'url', state: withPageReset({ ...state, q: undefined }) }
  }

  if (chipId.startsWith('kind:')) {
    return { kind: 'url', state: withPageReset({ ...state, kind: undefined }) }
  }

  return { kind: 'url', state }
}

export const clearOrganizationOmnibox = (
  _state: OrganizationListState,
): OrganizationOmniboxAction => ({
  kind: 'clear',
  state: withPageReset({ page: 1 }),
})
