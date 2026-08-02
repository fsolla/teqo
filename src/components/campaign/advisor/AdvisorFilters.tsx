'use client'

import { useMemo, useState } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import type { AdvisorFilterOption } from '@/utilities/advisor/advisorListFilters'
import { advisorListHrefForPage, type AdvisorListState } from '@/utilities/advisor/advisorListUrl'
import {
  applyAdvisorOmniboxSuggestion,
  buildAdvisorOmniboxChips,
  buildAdvisorOmniboxSuggestionSeeds,
  clearAdvisorOmnibox,
  filterAdvisorOmniboxSuggestions,
  removeAdvisorOmniboxChip,
  type AdvisorOmniboxAction,
} from '@/utilities/advisor/advisorOmnibox'

export const AdvisorFilters = ({
  state,
  municipalityFilterOptions,
}: {
  state: AdvisorListState
  municipalityFilterOptions: AdvisorFilterOption[]
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => advisorListHrefForPage(next, 1),
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
    () => buildAdvisorOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () => buildAdvisorOmniboxSuggestionSeeds({ municipalityFilterOptions }),
    [municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterAdvisorOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: AdvisorOmniboxAction) => {
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
        label="Filtrar assessores"
        placeholder="Digite para buscar por nome, e-mail ou município da carteira…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyAdvisorOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyAdvisorOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeAdvisorOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearAdvisorOmnibox(state))
        }}
      />
    </form>
  )
}
