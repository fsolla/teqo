'use client'

import { CampaignMobileMultiFilterField } from '@/components/campaign/shared/CampaignMobileMultiFilterField'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  buildStateDeputyFilterHref,
  buildStateDeputyPartyOptions,
  clearStateDeputyListFilters,
  formatStateDeputyActiveFiltersSummary,
  toggleStateDeputyPartyFilter,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {
  parseStateDeputySortValue,
  resolveStateDeputyListSort,
  serializeStateDeputySortValue,
  stateDeputyListSortOptions,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

export const StateDeputyFilters = ({
  state,
  partyOptions,
  hasNoParty,
}: {
  state: StateDeputyListState
  /** Distinct party names present under the current search (server-computed facet). */
  partyOptions: StateDeputyFilterOption[]
  /** Whether at least one facet-matching row has no party — gates the "Sem partido" option. */
  hasNoParty: boolean
}) => {
  const { search, onSearchChange, draftQ, isPending, navigateWithSearch, clearSearchAndNavigate } =
    useCampaignListFilterNavigation({ state, toHref: buildStateDeputyFilterHref })
  const { sort, dir } = resolveStateDeputyListSort(state)
  const mobilePartyOptions = buildStateDeputyPartyOptions(partyOptions, hasNoParty)
  const activeSummary = formatStateDeputyActiveFiltersSummary({ ...state, q: draftQ })

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
          id="state-deputy-search"
          label="Buscar dobradinha"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {activeSummary ? (
          <p className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block md:self-center md:pb-2">
            {activeSummary}
          </p>
        ) : null}
        {activeSummary ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 md:self-end"
            onClick={() => clearSearchAndNavigate(clearStateDeputyListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {activeSummary ? <p className="text-sm text-muted-foreground">{activeSummary}</p> : null}
        <CampaignMobileMultiFilterField
          id="state-deputy-filter-party"
          label="Partido"
          emptyLabel="Todos"
          options={mobilePartyOptions}
          selected={state.parties ?? []}
          onToggle={(value) => navigateWithSearch(toggleStateDeputyPartyFilter(state, value))}
        />

        <Field>
          <FieldLabel htmlFor="state-deputy-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="state-deputy-sort"
            value={serializeStateDeputySortValue(sort, dir)}
            onChange={(event) => {
              const parsed = parseStateDeputySortValue(event.target.value)
              if (parsed) navigateWithSearch({ ...state, sort: parsed.key, dir: parsed.dir })
            }}
            className="w-full [&_select]:h-11"
          >
            {stateDeputyListSortOptions.map((option) => (
              <NativeSelectOption
                key={serializeStateDeputySortValue(option.key, option.dir)}
                value={serializeStateDeputySortValue(option.key, option.dir)}
              >
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </form>
  )
}
