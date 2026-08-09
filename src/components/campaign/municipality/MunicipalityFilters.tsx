'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'

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
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'
import {
  applyMunicipalityOmniboxSuggestion,
  buildMunicipalityOmniboxChips,
  buildMunicipalityOmniboxSuggestionSeeds,
  clearMunicipalityOmnibox,
  filterMunicipalityOmniboxSuggestions,
  removeMunicipalityOmniboxChip,
  type MunicipalityOmniboxAction,
} from '@/utilities/municipality/municipalityOmnibox'

type MunicipalityFiltersProps = {
  state: MunicipalityListState
  showStaffFilters: boolean
  /** Territory options already narrowed by the other active filters. */
  regionFilterOptions: MunicipalityFilterOption[]
  /** Advisor options already narrowed by the other active filters. */
  advisorFilterOptions: MunicipalityFilterOption[]
  /** B176 — Dobradinha, Liderança and Partido options (named, narrowed). */
  stateDeputyFilterOptions: MunicipalityFilterOption[]
  leadershipFilterOptions: MunicipalityFilterOption[]
  partyFilterOptions: MunicipalityFilterOption[]
  /** Facet slugs (labeled from the catalog on the client). */
  slugFilterValues?: readonly string[]
  /** Beside the omnibox (B137): column picker, save bookmark, … */
  trailing?: ReactNode
}

/** Chip-label lookup for a numeric-id filter dimension (advisor/dobradinha/liderança). */
const labelsByIdFromOptions = (
  options: readonly MunicipalityFilterOption[],
): Map<number, string> => {
  const map = new Map<number, string>()
  for (const option of options) {
    const id = Number(option.value)
    if (Number.isSafeInteger(id) && id > 0) map.set(id, option.label)
  }
  return map
}

export const MunicipalityFilters = ({
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  stateDeputyFilterOptions = [],
  leadershipFilterOptions = [],
  partyFilterOptions = [],
  slugFilterValues = [],
  trailing,
}: MunicipalityFiltersProps) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
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

  const advisorLabelsById = useMemo(
    () => labelsByIdFromOptions(advisorFilterOptions),
    [advisorFilterOptions],
  )

  const stateDeputyLabelsById = useMemo(
    () => labelsByIdFromOptions(stateDeputyFilterOptions),
    [stateDeputyFilterOptions],
  )

  const leadershipLabelsById = useMemo(
    () => labelsByIdFromOptions(leadershipFilterOptions),
    [leadershipFilterOptions],
  )

  const chips = useMemo(
    () =>
      buildMunicipalityOmniboxChips({
        state,
        scenario,
        showStaffFilters,
        advisorLabelsById,
        stateDeputyLabelsById,
        leadershipLabelsById,
      }),
    [
      state,
      scenario,
      showStaffFilters,
      advisorLabelsById,
      stateDeputyLabelsById,
      leadershipLabelsById,
    ],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildMunicipalityOmniboxSuggestionSeeds({
        showStaffFilters,
        regionFilterOptions,
        advisorFilterOptions,
        slugFilterOptions,
        stateDeputyFilterOptions,
        leadershipFilterOptions,
        partyFilterOptions,
      }),
    [
      showStaffFilters,
      regionFilterOptions,
      advisorFilterOptions,
      slugFilterOptions,
      stateDeputyFilterOptions,
      leadershipFilterOptions,
      partyFilterOptions,
    ],
  )

  const suggestions = useMemo(
    () => filterMunicipalityOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: MunicipalityOmniboxAction) => {
    if (action.kind === 'scenario') {
      setScenario?.(action.scenario)
      return
    }
    if (action.kind === 'clear') {
      setScenario?.(action.scenario)
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
        onCommitQuery={(text) => {
          runAction(applyMunicipalityOmniboxSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeMunicipalityOmniboxChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearMunicipalityOmnibox(state))
        }}
        trailing={[
          // React reconciles unkeyed fragments' children as a keyed list — a
          // bare `<> {trailing} <Save…/> </>` logs a key warning on every
          // municipios render (and fails the e2e console guard). Keyed array
          // children keep the two controls side by side without the warning.
          <Fragment key="column-picker">{trailing}</Fragment>,
          <SaveMunicipalityFilterControl key="save-filter" state={state} />,
        ]}
      />
    </form>
  )
}
