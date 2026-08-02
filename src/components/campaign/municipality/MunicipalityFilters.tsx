'use client'

import { useMemo, useState } from 'react'

import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { SaveMunicipalityFilterControl } from '@/components/campaign/municipality/SaveMunicipalityFilterControl'
import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import {
  buildMunicipalityFilterHref,
  municipalityFilterOptionsForSlugs,
  type MunicipalityFilterOption,
} from '@/utilities/municipality/municipalityListFilters'
import {
  applyMunicipalityOmniboxSuggestion,
  buildMunicipalityOmniboxChips,
  buildMunicipalityOmniboxSuggestions,
  clearMunicipalityOmnibox,
  removeMunicipalityOmniboxChip,
} from '@/utilities/municipality/municipalityOmnibox'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'

type MunicipalityFiltersProps = {
  state: MunicipalityListState
  showStaffFilters: boolean
  /** Territory options already narrowed by the other active filters. */
  regionFilterOptions: MunicipalityFilterOption[]
  /** Advisor options already narrowed by the other active filters. */
  advisorFilterOptions: MunicipalityFilterOption[]
  /** Facet slugs (labeled from the catalog on the client). */
  slugFilterValues?: readonly string[]
}

export const MunicipalityFilters = ({
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  slugFilterValues = [],
}: MunicipalityFiltersProps) => {
  const { navigateWithSearch, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildMunicipalityFilterHref,
  })
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const scenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const setScenario = scenarioContext?.setScenario
  const [query, setQuery] = useState('')

  const slugFilterOptions = useMemo(
    () => municipalityFilterOptionsForSlugs(slugFilterValues),
    [slugFilterValues],
  )

  const advisorLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of advisorFilterOptions) {
      const id = Number(option.value)
      if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
    }
    return map
  }, [advisorFilterOptions])

  const chips = buildMunicipalityOmniboxChips({
    state,
    scenario,
    showStaffFilters,
    advisorLabelsById,
  })

  const suggestions = buildMunicipalityOmniboxSuggestions({
    query,
    showStaffFilters,
    regionFilterOptions,
    advisorFilterOptions,
    slugFilterOptions,
  })

  const runAction = (action: ReturnType<typeof applyMunicipalityOmniboxSuggestion>) => {
    if (action.kind === 'scenario') {
      setScenario?.(action.scenario)
      return
    }
    if (action.kind === 'clear') {
      setScenario?.(action.scenario)
      setQuery('')
      navigateWithSearch(action.state)
      return
    }
    navigateWithSearch(action.state)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <CampaignListOmnibox
        id="municipality-omnibox"
        label="Filtrar municípios"
        placeholder="Digite para filtrar (município, território, cenário…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyMunicipalityOmniboxSuggestion({ state, suggestionId }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeMunicipalityOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearMunicipalityOmnibox(state))
        }}
        trailing={<SaveMunicipalityFilterControl state={state} />}
      />
    </form>
  )
}
