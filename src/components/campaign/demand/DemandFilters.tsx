'use client'

import { useMemo, useState } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { buildDemandListHref } from '@/utilities/demand/demandListUrl'
import {
  applyDemandOmniboxSuggestion,
  buildDemandOmniboxChips,
  buildDemandOmniboxSuggestionSeeds,
  clearDemandOmnibox,
  filterDemandOmniboxSuggestions,
  removeDemandOmniboxChip,
  type DemandListState,
  type DemandOmniboxAction,
} from '@/utilities/demand/demandOmnibox'

export const DemandFilters = ({ state }: { state: DemandListState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildDemandListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const chips = useMemo(() => buildDemandOmniboxChips(state), [state])

  const suggestionSeeds = useMemo(() => buildDemandOmniboxSuggestionSeeds(), [])

  const suggestions = useMemo(
    () => filterDemandOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: DemandOmniboxAction) => {
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
        id="demand-omnibox"
        label="Filtrar demandas por status"
        placeholder="Digite para filtrar por status…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyDemandOmniboxSuggestion({ state, suggestionId }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeDemandOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearDemandOmnibox(state))
        }}
      />
    </form>
  )
}
