'use client'

import { useMemo, useState } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  applySearchOnlyOmniboxSuggestion,
  buildSearchOnlyOmniboxChips,
  buildSearchOnlyOmniboxSuggestions,
  clearSearchOnlyOmnibox,
  removeSearchOnlyOmniboxChip,
  type SearchOnlyOmniboxAction,
} from '@/lib/searchOnlyListOmnibox'
import {
  buildOrganizationListHref,
  type OrganizationListState,
} from '@/utilities/organization/organizationListUrl'

export const OrganizationFilters = ({ state }: { state: OrganizationListState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildOrganizationListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const withPageReset = (next: OrganizationListState): OrganizationListState => ({ ...next, page: 1 })

  const chips = useMemo(() => buildSearchOnlyOmniboxChips(state), [state])

  const suggestions = useMemo(() => buildSearchOnlyOmniboxSuggestions(query), [query])

  const runAction = (action: SearchOnlyOmniboxAction<OrganizationListState>) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <CampaignListOmnibox
        id="organization-omnibox"
        label="Buscar organização por nome"
        placeholder="Digite para buscar por nome…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(
            applySearchOnlyOmniboxSuggestion({
              state,
              suggestionId,
              withPageReset,
            }),
          )
        }}
        onCommitQuery={(text) => {
          runAction(
            applySearchOnlyOmniboxSuggestion({
              state,
              suggestionId: `q:${text}`,
              withPageReset,
            }),
          )
        }}
        onRemoveChip={(chipId) => {
          runAction(removeSearchOnlyOmniboxChip({ state, chipId, withPageReset }))
        }}
        onClearAll={() => {
          runAction(
            clearSearchOnlyOmnibox({
              state,
              cleared: withPageReset({ page: 1, ...(state.kind ? { kind: state.kind } : {}) }),
            }),
          )
        }}
      />
    </form>
  )
}
