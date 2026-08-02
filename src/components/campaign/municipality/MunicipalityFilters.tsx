'use client'

import { useMunicipalityEstimateScenario } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { MunicipalityMobileFilterCombobox } from '@/components/campaign/municipality/MunicipalityMobileFilterCombobox'
import { SaveMunicipalityFilterControl } from '@/components/campaign/municipality/SaveMunicipalityFilterControl'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  VOTE_ESTIMATE_SCENARIO_FILTERS_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/votePledge/VoteEstimateScenarioField'
import { Button } from '@/components/ui/button'
import {
  buildMunicipalityFilterHref,
  clearMunicipalityListFilters,
  formatMunicipalityActiveFiltersSummary,
  type MunicipalityFilterOption,
} from '@/utilities/municipality/municipalityListFilters'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'

const MunicipalityFilterEstimateScenario = ({
  className,
  id,
}: {
  className?: string
  id: string
}) => {
  const { scenario, setScenario } = useMunicipalityEstimateScenario()
  return (
    <VoteEstimateScenarioField
      id={id}
      value={scenario}
      onChange={setScenario}
      hint={VOTE_ESTIMATE_SCENARIO_FILTERS_HINT}
      className={className}
    />
  )
}

type MunicipalityFiltersProps = {
  state: MunicipalityListState
  showStaffFilters: boolean
  /** Territory options already narrowed by the other active filters. */
  regionFilterOptions: MunicipalityFilterOption[]
  /** Advisor options already narrowed by the other active filters. */
  advisorFilterOptions: MunicipalityFilterOption[]
}

export const MunicipalityFilters = ({
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
}: MunicipalityFiltersProps) => {
  const {
    search,
    setSearch,
    onSearchChange,
    draftQ,
    isPending,
    navigateWithSearch,
    clearSearchAndNavigate,
  } = useCampaignListFilterNavigation({ state, toHref: buildMunicipalityFilterHref })
  const activeFiltersSummary = formatMunicipalityActiveFiltersSummary({
    ...state,
    q: draftQ,
  })
  const hasActiveFilters = Boolean(activeFiltersSummary)

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        navigateWithSearch(state)
      }}
    >
      {/* B120 — mobile: one combobox (chips + typeahead) replaces the NativeSelect stack. */}
      <div className="md:hidden">
        <MunicipalityMobileFilterCombobox
          id="municipality-mobile-filter"
          state={state}
          showStaffFilters={showStaffFilters}
          regionFilterOptions={regionFilterOptions}
          advisorFilterOptions={advisorFilterOptions}
          search={search}
          onSearchChange={onSearchChange}
          clearSearchBox={() => setSearch('')}
          onNavigate={navigateWithSearch}
          onNavigateClearingSearch={clearSearchAndNavigate}
        />
      </div>

      {/* Desktop: search + summary + scenario; column filters stay on table heads (B16). */}
      <div className="hidden flex-col gap-3 md:flex md:flex-row md:items-end">
        <CampaignSearchInput
          id="municipality-search"
          label="Buscar município"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {activeFiltersSummary ? (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground md:self-center md:pb-2 md:whitespace-normal">
            {activeFiltersSummary}
          </p>
        ) : null}
        {showStaffFilters ? (
          <MunicipalityFilterEstimateScenario
            id="municipality-filter-estimate-scenario"
            className="shrink-0 md:self-end"
          />
        ) : null}
      </div>

      {/* Shared actions — one Limpar/Salvar for both breakpoints (B120 / B18). */}
      <div className="flex flex-wrap gap-2 md:items-end">
        <SaveMunicipalityFilterControl state={state} />
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0"
            onClick={() => clearSearchAndNavigate(clearMunicipalityListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>
    </form>
  )
}
