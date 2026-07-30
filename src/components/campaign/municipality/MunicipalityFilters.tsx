'use client'

import { useMunicipalityEstimateScenario } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { SaveMunicipalityFilterControl } from '@/components/campaign/municipality/SaveMunicipalityFilterControl'
import { CampaignMobileMultiFilterField } from '@/components/campaign/shared/CampaignMobileMultiFilterField'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  VOTE_ESTIMATE_SCENARIO_FILTERS_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/votePledge/VoteEstimateScenarioField'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  buildMunicipalityFilterHref,
  clearMunicipalityListFilters,
  formatMunicipalityActiveFiltersSummary,
  getMunicipalityMultiFilterValues,
  municipalityFilterDefinitions,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  type MunicipalityFilterOption,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipality/municipalityListFilters'
import {
  municipalityListSortOptions,
  parseMunicipalitySortValue,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

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
  const { search, onSearchChange, draftQ, isPending, navigateWithSearch, clearSearchAndNavigate } =
    useCampaignListFilterNavigation({ state, toHref: buildMunicipalityFilterHref })
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const activeFiltersSummary = formatMunicipalityActiveFiltersSummary({
    ...state,
    q: draftQ,
  })
  const hasActiveFilters = Boolean(activeFiltersSummary)

  const mobileFilterDefinitions = municipalityFilterDefinitions.filter((definition) => {
    if (definition.staffOnly && !showStaffFilters) return false
    if (definition.param === 'name') return false
    return true
  })

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
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="municipality-search"
          label="Buscar município"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {activeFiltersSummary ? (
          <p className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block md:self-center md:pb-2 md:whitespace-normal">
            {activeFiltersSummary}
          </p>
        ) : null}
        {showStaffFilters ? (
          <MunicipalityFilterEstimateScenario
            id="municipality-filter-estimate-scenario"
            className="hidden shrink-0 md:block md:self-end"
          />
        ) : null}
        <SaveMunicipalityFilterControl state={state} />
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 md:self-end"
            onClick={() => clearSearchAndNavigate(clearMunicipalityListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {activeFiltersSummary ? (
          <p className="text-sm text-muted-foreground">{activeFiltersSummary}</p>
        ) : null}
        {showStaffFilters ? (
          <Field>
            <FieldLabel htmlFor="municipality-filter-priority">Prioridade</FieldLabel>
            <NativeSelect
              id="municipality-filter-priority"
              value={state.priority ?? ''}
              onChange={(event) => {
                navigateWithSearch({
                  ...state,
                  priority: event.target.value === 'alta' ? 'alta' : undefined,
                })
              }}
              className="min-h-11 w-full"
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              <NativeSelectOption value="alta">Prioritária</NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : null}
        {mobileFilterDefinitions.map((definition) => {
          if (definition.selection === 'multi') {
            let options = definition.options ?? []
            if (definition.param === 'region') options = regionFilterOptions
            if (definition.param === 'advisor') options = advisorFilterOptions

            if (options.length === 0) return null

            let selected: string[] = []
            if (definition.param !== 'region' && definition.param !== 'advisor') {
              selected = getMunicipalityMultiFilterValues(
                state,
                definition.param as MunicipalityMultiFilterParam,
              )
            } else if (definition.param === 'region') {
              selected = state.regions ?? []
            } else if (definition.param === 'advisor') {
              selected = (state.advisors ?? []).map(String)
            }

            return (
              <CampaignMobileMultiFilterField
                key={definition.param}
                id={`municipality-filter-${definition.param}`}
                label={definition.label}
                emptyLabel={definition.emptyLabel ?? 'Todos'}
                options={options}
                selected={selected}
                onToggle={(value) =>
                  navigateWithSearch(
                    toggleMunicipalityMultiFilterValue(
                      state,
                      definition.param as MunicipalityMultiFilterParam,
                      value,
                    ),
                  )
                }
              />
            )
          }

          const value = definition.param === 'coverage' ? (state.coverage ?? '') : ''
          return (
            <Field key={definition.param}>
              <FieldLabel htmlFor={`municipality-filter-${definition.param}`}>
                {definition.label}
              </FieldLabel>
              <NativeSelect
                id={`municipality-filter-${definition.param}`}
                value={value}
                onChange={(event) => {
                  const selected = event.target.value
                  if (definition.selection === 'toggle') {
                    navigateWithSearch(
                      selected
                        ? toggleMunicipalityExclusiveFilterValue(state, 'coverage', selected)
                        : { ...state, coverage: undefined },
                    )
                  }
                }}
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">{definition.allLabel ?? 'Todas'}</NativeSelectOption>
                {(definition.options ?? []).map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )
        })}
        {showStaffFilters ? (
          <MunicipalityFilterEstimateScenario
            id="municipality-filter-estimate-scenario-mobile"
            className="md:hidden"
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor="municipality-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="municipality-sort"
            value={serializeMunicipalitySortValue(activeSort, activeDir)}
            onChange={(event) => {
              const parsed = parseMunicipalitySortValue(event.target.value)
              if (parsed) navigateWithSearch({ ...state, sort: parsed.key, dir: parsed.dir })
            }}
            className="min-h-11 w-full"
          >
            {municipalityListSortOptions.map(({ key, dir, label }) => (
              <NativeSelectOption
                key={serializeMunicipalitySortValue(key, dir)}
                value={serializeMunicipalitySortValue(key, dir)}
              >
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </form>
  )
}
