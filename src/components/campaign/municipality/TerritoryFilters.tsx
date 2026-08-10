'use client'

import { useMemo, useState, type ReactNode } from 'react'

import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import type { TerritoryFilterOption } from '@/utilities/territory/territoryListFilters'
import {
  buildTerritoryListHref,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'
import {
  applyTerritoryOmniboxSuggestion,
  buildTerritoryOmniboxChips,
  buildTerritoryOmniboxSuggestionSeeds,
  clearTerritoryOmnibox,
  filterTerritoryOmniboxSuggestions,
  removeTerritoryOmniboxChip,
  type TerritoryOmniboxAction,
} from '@/utilities/territory/territoryOmnibox'

export const TerritoryFilters = ({
  state,
  regionOptions,
  trailing,
}: {
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildTerritoryListHref,
  })
  const [query, setQuery] = useState('')

  const chips = useMemo(() => buildTerritoryOmniboxChips(state), [state])

  const suggestionSeeds = useMemo(
    () => buildTerritoryOmniboxSuggestionSeeds(regionOptions),
    [regionOptions],
  )

  const suggestions = useMemo(
    () => filterTerritoryOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: TerritoryOmniboxAction) => {
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
      className={campaignListOmniboxFormClassName}
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <CampaignListOmnibox
        id="territory-omnibox"
        label="Filtrar territórios"
        placeholder="Digite para filtrar (território, assessoria, ordenar…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyTerritoryOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyTerritoryOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeTerritoryOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearTerritoryOmnibox(state))
        }}
        trailing={trailing}
      />
    </form>
  )
}
