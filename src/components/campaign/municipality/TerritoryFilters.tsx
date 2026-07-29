'use client'

import { CampaignMobileMultiFilterField } from '@/components/campaign/shared/CampaignMobileMultiFilterField'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  clearTerritoryListFilters,
  formatTerritoryActiveFiltersSummary,
  territoryCoverageLabels,
  toggleTerritoryRegionFilter,
  type TerritoryFilterOption,
} from '@/utilities/territory/territoryListFilters'
import {
  buildTerritoryListHref,
  parseTerritorySortValue,
  resolveTerritoryListSort,
  serializeTerritorySortValue,
  territoryListSortOptions,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'

export const TerritoryFilters = ({
  state,
  regionOptions,
}: {
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
}) => {
  const { search, onSearchChange, draftQ, isPending, navigateWithSearch, clearSearchAndNavigate } =
    useCampaignListFilterNavigation({ state, toHref: buildTerritoryListHref })
  const { sort, dir } = resolveTerritoryListSort(state)
  const activeSummary = formatTerritoryActiveFiltersSummary({ ...state, q: draftQ })

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
          id="territory-search"
          label="Buscar território"
          placeholder="Buscar por território…"
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
            onClick={() => clearSearchAndNavigate(clearTerritoryListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {activeSummary ? <p className="text-sm text-muted-foreground">{activeSummary}</p> : null}
        <CampaignMobileMultiFilterField
          id="territory-filter-region"
          label="Território"
          emptyLabel="Todos"
          options={regionOptions}
          selected={state.regions ?? []}
          onToggle={(value) => navigateWithSearch(toggleTerritoryRegionFilter(state, value))}
        />

        <Field>
          <FieldLabel htmlFor="territory-filter-coverage">Assessoria</FieldLabel>
          <NativeSelect
            id="territory-filter-coverage"
            value={state.coverage ?? ''}
            onChange={(event) =>
              navigateWithSearch({
                ...state,
                coverage:
                  event.target.value === 'com_assessor' || event.target.value === 'sem_assessor'
                    ? event.target.value
                    : undefined,
              })
            }
            className="w-full [&_select]:h-11"
          >
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {Object.entries(territoryCoverageLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="territory-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="territory-sort"
            value={serializeTerritorySortValue(sort, dir)}
            onChange={(event) => {
              const parsed = parseTerritorySortValue(event.target.value)
              if (parsed) navigateWithSearch({ ...state, sort: parsed.key, dir: parsed.dir })
            }}
            className="w-full [&_select]:h-11"
          >
            {territoryListSortOptions.map((option) => (
              <NativeSelectOption
                key={serializeTerritorySortValue(option.key, option.dir)}
                value={serializeTerritorySortValue(option.key, option.dir)}
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
