'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { buildDemandListHref, type DemandListState } from '@/utilities/demand/demandListUrl'
import {
  applyDemandOmniboxSuggestion,
  buildDemandOmniboxChips,
  buildDemandOmniboxSuggestionSeeds,
  clearDemandOmnibox,
  filterDemandOmniboxSuggestions,
  removeDemandOmniboxChip,
  type DemandOmniboxAction,
} from '@/utilities/demand/demandOmnibox'

export const DemandFilters = ({
  state,
  trailing,
  totalDocs,
}: {
  state: DemandListState
  trailing?: ReactNode
  totalDocs?: number
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildDemandListHref,
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
        label="Filtrar demandas"
        placeholder="Digite para buscar ou filtrar por tipo e status…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        totalDocs={totalDocs}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyDemandOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyDemandOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeDemandOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearDemandOmnibox(state))
        }}
        trailing={trailing}
      />
    </form>
  )
}
