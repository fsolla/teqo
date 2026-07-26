'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { useCampaignListPending } from '@/components/campaign/shared/CampaignListPending'
import { CampaignMobileMultiFilterField } from '@/components/campaign/shared/CampaignMobileMultiFilterField'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { normalizedText } from '@/utilities/campaignListUrl'
import {
  clearTerritoryListFilters,
  formatTerritoryActiveFiltersSummary,
  territoryCoverageLabels,
  toggleTerritoryRegionFilter,
  type TerritoryFilterOption,
} from '@/utilities/territoryListFilters'
import {
  buildTerritoryListHref,
  parseTerritoryListParams,
  parseTerritorySortValue,
  resolveTerritoryListSort,
  serializeTerritorySortValue,
  territoryListSortOptions,
  territoryListStateToRawParams,
  type TerritoryListState,
} from '@/utilities/territoryListUrl'

const SEARCH_DEBOUNCE_MS = 1000

export const TerritoryFilters = ({
  state,
  regionOptions,
}: {
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')
  const sharedPending = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  const isPending = sharedPending?.isPending ?? isLocalPending
  const startTransition = sharedPending?.startTransition ?? startLocalTransition
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { sort, dir } = resolveTerritoryListSort(state)
  const activeSummary = formatTerritoryActiveFiltersSummary({
    ...state,
    q: normalizedText(search) || state.q,
  })

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const clearDebounce = () => {
    if (!debounceRef.current) return
    clearTimeout(debounceRef.current)
    debounceRef.current = null
  }

  const navigateTo = (next: TerritoryListState) => {
    clearDebounce()
    const canonical = parseTerritoryListParams(
      territoryListStateToRawParams({ ...next, q: normalizedText(next.q) }),
    )
    if (buildTerritoryListHref(canonical) === buildTerritoryListHref(state)) return
    startTransition(() => {
      router.replace(buildTerritoryListHref(canonical), { scroll: false })
    })
  }

  const scheduleSearch = (value: string) => {
    clearDebounce()
    if (normalizedText(value) === state.q) return
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      navigateTo({ ...state, q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        navigateTo({ ...state, q: search })
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="territory-search"
          label="Buscar território"
          placeholder="Buscar por território…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            scheduleSearch(event.target.value)
          }}
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
            onClick={() => {
              clearDebounce()
              setSearch('')
              navigateTo(clearTerritoryListFilters(state))
            }}
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
          onToggle={(value) => navigateTo(toggleTerritoryRegionFilter(state, value))}
        />

        <Field>
          <FieldLabel htmlFor="territory-filter-coverage">Assessoria</FieldLabel>
          <NativeSelect
            id="territory-filter-coverage"
            value={state.coverage ?? ''}
            onChange={(event) =>
              navigateTo({
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
              if (parsed) navigateTo({ ...state, sort: parsed.key, dir: parsed.dir })
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
