'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  buildOrganizationListHref,
  type OrganizationListState,
} from '@/utilities/organization/organizationListUrl'
import {
  applyOrganizationOmniboxSuggestion,
  buildOrganizationOmniboxChips,
  buildOrganizationOmniboxSuggestionSeeds,
  clearOrganizationOmnibox,
  filterOrganizationOmniboxSuggestions,
  removeOrganizationOmniboxChip,
  type OrganizationOmniboxAction,
} from '@/utilities/organization/organizationOmnibox'

export const OrganizationFilters = ({
  state,
  trailing,
}: {
  state: OrganizationListState
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildOrganizationListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const chips = useMemo(() => buildOrganizationOmniboxChips(state), [state])

  const suggestionSeeds = useMemo(() => buildOrganizationOmniboxSuggestionSeeds(), [])

  const suggestions = useMemo(
    () => filterOrganizationOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: OrganizationOmniboxAction) => {
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
        label="Buscar organização por nome ou tipo"
        placeholder="Digite para buscar por nome ou tipo…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyOrganizationOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(
            applyOrganizationOmniboxSuggestion({
              state,
              suggestionId: `q:${text}`,
            }),
          )
        }}
        onRemoveChip={(chipId) => {
          runAction(removeOrganizationOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearOrganizationOmnibox(state))
        }}
        trailing={trailing}
      />
    </form>
  )
}
