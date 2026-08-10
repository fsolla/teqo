'use client'

import { useMemo, useState } from 'react'

import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  applyActivityOmniboxSuggestion,
  buildActivityOmniboxChips,
  buildActivityOmniboxSuggestionSeeds,
  clearActivityOmnibox,
  filterActivityOmniboxSuggestions,
  removeActivityOmniboxChip,
  type ActivityOmniboxAction,
} from '@/utilities/activityOmnibox'
import { buildActivityListHref, type ActivityListState } from '@/utilities/activityUi'

export const ActivityFilters = ({
  state,
  municipalityOptions,
}: {
  state: ActivityListState
  municipalityOptions: RelationOption[]
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildActivityListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityOptions) {
      if (Number.isSafeInteger(option.id) && option.id > 0) map.set(option.id, option.name)
    }
    return map
  }, [municipalityOptions])

  const municipalityFilterOptions = useMemo(
    () =>
      municipalityOptions.map((option) => ({
        value: String(option.id),
        label: option.name,
      })),
    [municipalityOptions],
  )

  const chips = useMemo(
    () => buildActivityOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildActivityOmniboxSuggestionSeeds({
        tab: state.tab,
        municipalityOptions: municipalityFilterOptions,
      }),
    [state.tab, municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterActivityOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: ActivityOmniboxAction) => {
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
        id="activity-omnibox"
        label="Filtrar atividades"
        placeholder="Digite para filtrar (janela, tipo, título, município…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyActivityOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyActivityOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeActivityOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearActivityOmnibox(state))
        }}
      />
    </form>
  )
}
