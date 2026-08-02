'use client'

import { useMemo, useState, type ReactNode } from 'react'

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
  organizationFilterOptions,
  stateDeputyFilterOptions,
  trailing,
}: {
  state: LeadershipListState
  municipalityFilterOptions: LeadershipFilterOption[]
  organizationFilterOptions: LeadershipFilterOption[]
  stateDeputyFilterOptions: LeadershipFilterOption[]
  trailing?: ReactNode
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

  const organizationLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of organizationFilterOptions) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    for (const organizationId of state.organizations ?? []) {
      if (!map.has(organizationId)) map.set(organizationId, `Organização #${organizationId}`)
    }
    return map
  }, [organizationFilterOptions, state.organizations])

  const stateDeputyLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of stateDeputyFilterOptions) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    for (const stateDeputyId of state.stateDeputies ?? []) {
      if (!map.has(stateDeputyId)) map.set(stateDeputyId, `Dobradinha #${stateDeputyId}`)
    }
    return map
  }, [stateDeputyFilterOptions, state.stateDeputies])

  const chips = useMemo(
    () =>
      buildLeadershipOmniboxChips({
        state,
        municipalityLabelsById,
        organizationLabelsById,
        stateDeputyLabelsById,
      }),
    [state, municipalityLabelsById, organizationLabelsById, stateDeputyLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildLeadershipOmniboxSuggestionSeeds({
        municipalityFilterOptions,
        organizationFilterOptions,
        stateDeputyFilterOptions,
      }),
    [municipalityFilterOptions, organizationFilterOptions, stateDeputyFilterOptions],
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
        placeholder="Digite para filtrar (status, município, organização, dobradinha…)"
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
        trailing={trailing}
      />
    </form>
  )
}
