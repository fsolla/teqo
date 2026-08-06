'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  buildStateDeputyFilterHref,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import type { StateDeputyListState } from '@/utilities/stateDeputyListUrl'
import {
  applyStateDeputyOmniboxSuggestion,
  buildStateDeputyOmniboxChips,
  buildStateDeputyOmniboxSuggestionSeeds,
  clearStateDeputyOmnibox,
  filterStateDeputyOmniboxSuggestions,
  removeStateDeputyOmniboxChip,
  type StateDeputyOmniboxAction,
} from '@/utilities/stateDeputyOmnibox'

export const StateDeputyFilters = ({
  state,
  partyOptions,
  hasNoParty,
  trailing,
  totalDocs,
}: {
  state: StateDeputyListState
  partyOptions: StateDeputyFilterOption[]
  hasNoParty: boolean
  trailing?: ReactNode
  totalDocs?: number
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildStateDeputyFilterHref,
  })
  const [query, setQuery] = useState('')

  const chips = useMemo(() => buildStateDeputyOmniboxChips(state), [state])

  const suggestionSeeds = useMemo(
    () => buildStateDeputyOmniboxSuggestionSeeds({ partyOptions, hasNoParty }),
    [partyOptions, hasNoParty],
  )

  const suggestions = useMemo(
    () => filterStateDeputyOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: StateDeputyOmniboxAction) => {
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
        id="state-deputy-omnibox"
        label="Filtrar dobradinhas"
        placeholder="Digite para filtrar (partido, ordenar…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        totalDocs={totalDocs}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyStateDeputyOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyStateDeputyOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeStateDeputyOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearStateDeputyOmnibox(state))
        }}
        trailing={trailing}
      />
    </form>
  )
}
