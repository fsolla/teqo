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
import { advisorListHrefForPage, type AdvisorListState } from '@/utilities/advisor/advisorListUrl'

export const AdvisorFilters = ({ state }: { state: AdvisorListState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => advisorListHrefForPage(next, 1),
  })
  const [query, setQuery] = useState('')

  const withPageReset = (next: AdvisorListState): AdvisorListState => ({ ...next, page: 1 })

  const chips = useMemo(() => buildSearchOnlyOmniboxChips(state), [state])

  const suggestions = useMemo(() => buildSearchOnlyOmniboxSuggestions(query), [query])

  const runAction = (action: SearchOnlyOmniboxAction<AdvisorListState>) => {
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
        id="advisor-omnibox"
        label="Buscar assessor por nome ou e-mail"
        placeholder="Digite para buscar por nome ou e-mail…"
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
              cleared: { page: 1 },
            }),
          )
        }}
      />
    </form>
  )
}
