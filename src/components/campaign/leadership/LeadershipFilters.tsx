'use client'

import { useMemo, useState } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  buildLeadershipFilterHref,
  type LeadershipFilterOption,
} from '@/utilities/leadership/leadershipListFilters'
import type { LeadershipListState } from '@/utilities/leadership/leadershipListUrl'
import {
  applyLeadershipOmniboxSuggestion,
  buildLeadershipOmniboxChips,
  buildLeadershipOmniboxSuggestionSeeds,
  clearLeadershipOmnibox,
  filterLeadershipOmniboxSuggestions,
  removeLeadershipOmniboxChip,
  type LeadershipOmniboxAction,
} from '@/utilities/leadership/leadershipOmnibox'

export const LeadershipFilters = ({
  state,
  municipalityFilterOptions,
}: {
  state: LeadershipListState
  municipalityFilterOptions: LeadershipFilterOption[]
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildLeadershipFilterHref,
  })
  const [query, setQuery] = useState('')

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityFilterOptions) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    return map
  }, [municipalityFilterOptions])

  const chips = useMemo(
    () => buildLeadershipOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () => buildLeadershipOmniboxSuggestionSeeds({ municipalityFilterOptions }),
    [municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterLeadershipOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: LeadershipOmniboxAction) => {
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
        id="leadership-omnibox"
        label="Filtrar lideranças"
        placeholder="Digite para filtrar (status, município, acesso…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyLeadershipOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyLeadershipOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeLeadershipOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearLeadershipOmnibox(state))
        }}
      />
    </form>
  )
}
