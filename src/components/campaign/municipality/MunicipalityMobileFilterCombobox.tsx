'use client'

import { FilterIcon, XIcon } from 'lucide-react'

import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { InputGroupAddon } from '@/components/ui/input-group'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type { MunicipalityFilterOption } from '@/utilities/municipality/municipalityListFilters'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'
import {
  applyMunicipalityMobileFilterOption,
  buildMunicipalityMobileFilterChips,
  buildMunicipalityMobileFilterOptions,
  dismissMunicipalityMobileFilterChip,
  findMunicipalityMobileFilterOption,
  type MunicipalityMobileFilterOption,
} from '@/utilities/municipality/municipalityMobileFilterCombobox'

type MunicipalityMobileFilterComboboxProps = {
  id: string
  state: MunicipalityListState
  showStaffFilters: boolean
  regionFilterOptions: MunicipalityFilterOption[]
  advisorFilterOptions: MunicipalityFilterOption[]
  search: string
  onSearchChange: (value: string) => void
  /** Clear the box without arming the search debounce / URL write. */
  clearSearchBox: () => void
  onNavigate: (next: MunicipalityListState) => void
}

/**
 * B120 — GitHub-style filter combobox for the municipalities list on mobile.
 * Chips + typeahead over B18 URL state; free text without a pick debounces to `q`.
 */
export const MunicipalityMobileFilterCombobox = ({
  id,
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
  search,
  onSearchChange,
  clearSearchBox,
  onNavigate,
}: MunicipalityMobileFilterComboboxProps) => {
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const scenario = scenarioContext?.scenario ?? DEFAULT_VOTE_ESTIMATE_SCENARIO
  const setScenario = scenarioContext?.setScenario

  const options = buildMunicipalityMobileFilterOptions({
    state,
    showStaffFilters,
    regionFilterOptions,
    advisorFilterOptions,
    scenario,
  })
  const chips = buildMunicipalityMobileFilterChips(state, options)

  const applyOption = (option: MunicipalityMobileFilterOption) => {
    const next = applyMunicipalityMobileFilterOption(state, option)
    if (next === 'scenario') {
      setScenario?.(option.kind === 'scenario' ? option.scenario : scenario)
      clearSearchBox()
      return
    }
    // Carry whatever is in the box as `q` (same contract as the old sort select),
    // then empty the typeahead for the next keyword.
    onNavigate(next)
    clearSearchBox()
  }

  const dismissChip = (chipId: string) => {
    const option = findMunicipalityMobileFilterOption(options, chipId)
    if (!option) return
    const next = dismissMunicipalityMobileFilterChip(state, option)
    if (next === 'scenario-default') {
      setScenario?.(DEFAULT_VOTE_ESTIMATE_SCENARIO)
      return
    }
    onNavigate(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs font-medium text-foreground"
                onClick={() => dismissChip(chip.id)}
                aria-label={`Remover filtro ${chip.label}`}
              >
                <span className="truncate">{chip.label}</span>
                <XIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Combobox<MunicipalityMobileFilterOption>
        items={options}
        value={null}
        inputValue={search}
        onInputValueChange={onSearchChange}
        onValueChange={(option) => {
          if (option) applyOption(option)
        }}
        filter={(option, query) => {
          if (!query) return true
          // When the box is a name search (no option label matches), keep the
          // full catalog so a filter can still be picked while `q` is pending.
          const anyMatch = options.some((candidate) =>
            matchesAtWordStart(candidate.label, query),
          )
          return anyMatch ? matchesAtWordStart(option.label, query) : true
        }}
        isItemEqualToValue={(left, right) => left?.id === right?.id}
        itemToStringLabel={(option) => option.label}
      >
        <ComboboxInput
          id={id}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Filtrar municípios…"
          aria-label="Filtrar municípios"
          showTrigger
          showClear={Boolean(search)}
          className={cn('min-h-11 w-full rounded-lg')}
        >
          <InputGroupAddon align="inline-start">
            <FilterIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent className="w-(--anchor-width)">
          <ComboboxEmpty>Nenhuma opção. Continue digitando para buscar por nome.</ComboboxEmpty>
          <ComboboxList>
            {(option: MunicipalityMobileFilterOption) => (
              <ComboboxItem key={option.id} value={option}>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.active ? <span className="sr-only"> (ativo)</span> : null}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
