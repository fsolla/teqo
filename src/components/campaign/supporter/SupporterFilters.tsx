'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  applySupporterOmniboxSuggestion,
  buildSupporterOmniboxChips,
  buildSupporterOmniboxSuggestionSeeds,
  clearSupporterOmnibox,
  filterSupporterOmniboxSuggestions,
  removeSupporterOmniboxChip,
  type SupporterOmniboxAction,
} from '@/utilities/supporter/supporterOmnibox'
import { buildSupporterListHref, type SupporterListState } from '@/utilities/supporter/supporterUi'
import { municipalityComboboxOptions } from '@/utilities/territory/territoryComboboxOptions'

export const SupporterFilters = ({
  state,
  municipalityOptions,
  trailing,
}: {
  state: SupporterListState
  municipalityOptions: RelationOption[]
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildSupporterListHref(next, 1),
  })
  const [query, setQuery] = useState('')

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityOptions) {
      if (Number.isSafeInteger(option.id) && option.id > 0) map.set(option.id, option.name)
    }
    return map
  }, [municipalityOptions])

  const cityOptions = useMemo(
    () =>
      municipalityComboboxOptions().map((option) => ({ value: option.value, label: option.label })),
    [],
  )

  const municipalityFilterOptions = useMemo(
    () =>
      municipalityOptions.map((option) => ({
        value: String(option.id),
        label: option.name,
      })),
    [municipalityOptions],
  )

  const chips = useMemo(
    () => buildSupporterOmniboxChips({ state, municipalityLabelsById }),
    [state, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildSupporterOmniboxSuggestionSeeds({
        cityOptions,
        municipalityOptions: municipalityFilterOptions,
      }),
    [cityOptions, municipalityFilterOptions],
  )

  const suggestions = useMemo(
    () => filterSupporterOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: SupporterOmniboxAction) => {
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
        id="supporter-omnibox"
        label="Filtrar apoiadores"
        placeholder="Digite para filtrar (nome, intenção, fonte, cidade, município…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applySupporterOmniboxSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applySupporterOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeSupporterOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearSupporterOmnibox(state))
        }}
        trailing={trailing}
      />
    </form>
  )
}
