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
  buildStateDeputyPartyOptions,
  clearStateDeputyListFilters,
  formatStateDeputyActiveFiltersSummary,
  toggleStateDeputyPartyFilter,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import {
  buildStateDeputyListHref,
  parseStateDeputyListParams,
  parseStateDeputySortValue,
  resolveStateDeputyListSort,
  serializeStateDeputySortValue,
  stateDeputyListSortOptions,
  stateDeputyListStateToRawParams,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

const SEARCH_DEBOUNCE_MS = 1000

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
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')
  const sharedPending = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  const isPending = sharedPending?.isPending ?? isLocalPending
  const startTransition = sharedPending?.startTransition ?? startLocalTransition
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { sort, dir } = resolveStateDeputyListSort(state)
  const mobilePartyOptions = buildStateDeputyPartyOptions(partyOptions, hasNoParty)
  const activeSummary = formatStateDeputyActiveFiltersSummary({
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

  const navigateTo = (next: StateDeputyListState) => {
    clearDebounce()
    const canonical = parseStateDeputyListParams(
      stateDeputyListStateToRawParams({ ...next, q: normalizedText(next.q), page: 1 }, 1),
    )
    const nextHref = buildStateDeputyListHref(canonical, 1)
    if (nextHref === buildStateDeputyListHref(state, 1)) return
    startTransition(() => {
      router.replace(nextHref, { scroll: false })
    })
  }

  const scheduleSearch = (value: string) => {
    clearDebounce()
    if (normalizedText(value) === state.q) return
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      navigateTo({ ...state, q: value, page: 1 })
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
        navigateTo({ ...state, q: search, page: 1 })
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="state-deputy-search"
          label="Buscar dobradinha"
          placeholder="Buscar por nome…"
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
              navigateTo(clearStateDeputyListFilters(state))
            }}
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
          onToggle={(value) => navigateTo(toggleStateDeputyPartyFilter(state, value))}
        />

        <Field>
          <FieldLabel htmlFor="state-deputy-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="state-deputy-sort"
            value={serializeStateDeputySortValue(sort, dir)}
            onChange={(event) => {
              const parsed = parseStateDeputySortValue(event.target.value)
              if (parsed) navigateTo({ ...state, sort: parsed.key, dir: parsed.dir, page: 1 })
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
