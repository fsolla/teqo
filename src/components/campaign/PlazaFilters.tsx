'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { normalizedText } from '@/utilities/campaignListUrl'
import {
  buildPlazaFiltersKey,
  buildPlazaListHref,
  plazaKindLabels,
  plazaListCoverageLabels,
  politicalTrendLabels,
  shouldUpdatePlazaSearchUrl,
  type PlazaListState,
} from '@/utilities/plazaUi'

const SEARCH_DEBOUNCE_MS = 1000

type PlazaFiltersProps = {
  state: PlazaListState
  showStaffFilters: boolean
}

export const PlazaFilters = ({ state, showStaffFilters }: PlazaFiltersProps) => {
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const clearDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  const commitNavigation = (patch: Partial<PlazaListState>) => {
    clearDebounce()
    const merged: PlazaListState = {
      ...state,
      ...patch,
      page: 1,
      q: normalizedText(patch.q !== undefined ? patch.q : search),
    }
    if (buildPlazaFiltersKey(merged) === buildPlazaFiltersKey({ ...state, page: 1 })) return

    startTransition(() => {
      router.replace(buildPlazaListHref(merged, 1), { scroll: false })
    })
  }

  const scheduleSearchNavigation = (value: string) => {
    clearDebounce()
    if (!shouldUpdatePlazaSearchUrl(value, state.q)) return

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      commitNavigation({ q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  const hasActiveFilters = Boolean(
    state.q ||
      normalizedText(search) ||
      state.region ||
      state.kind ||
      state.coverage ||
      state.priority ||
      state.trend,
  )

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        commitNavigation({ q: search })
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="plaza-search"
          label="Buscar Praça"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => {
            const value = event.target.value
            setSearch(value)
            scheduleSearchNavigation(value)
          }}
        />
        <Field className="md:w-56">
          <FieldLabel htmlFor="plaza-filter-region">Território de identidade</FieldLabel>
          <NativeSelect
            id="plaza-filter-region"
            value={state.region ?? ''}
            onChange={(event) =>
              commitNavigation({
                region: (event.target.value || undefined) as PlazaListState['region'],
              })
            }
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {bahiaIdentityTerritories.map((territory) => (
              <NativeSelectOption key={territory} value={territory}>
                {territory}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="md:w-44">
          <FieldLabel htmlFor="plaza-filter-kind">Tipo</FieldLabel>
          <NativeSelect
            id="plaza-filter-kind"
            value={state.kind ?? ''}
            onChange={(event) =>
              commitNavigation({
                kind: (event.target.value || undefined) as PlazaListState['kind'],
              })
            }
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {(Object.keys(plazaKindLabels) as Array<keyof typeof plazaKindLabels>).map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {plazaKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {showStaffFilters ? (
          <>
            <Field className="md:w-44">
              <FieldLabel htmlFor="plaza-filter-coverage">Assessoria</FieldLabel>
              <NativeSelect
                id="plaza-filter-coverage"
                value={state.coverage ?? ''}
                onChange={(event) =>
                  commitNavigation({
                    coverage: (event.target.value || undefined) as PlazaListState['coverage'],
                  })
                }
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">Todas</NativeSelectOption>
                {(
                  Object.keys(plazaListCoverageLabels) as Array<
                    keyof typeof plazaListCoverageLabels
                  >
                ).map((coverage) => (
                  <NativeSelectOption key={coverage} value={coverage}>
                    {plazaListCoverageLabels[coverage]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="md:w-44">
              <FieldLabel htmlFor="plaza-filter-trend">Tendência</FieldLabel>
              <NativeSelect
                id="plaza-filter-trend"
                value={state.trend ?? ''}
                onChange={(event) =>
                  commitNavigation({
                    trend: (event.target.value || undefined) as PlazaListState['trend'],
                  })
                }
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">Todas</NativeSelectOption>
                {(
                  Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>
                ).map((trend) => (
                  <NativeSelectOption key={trend} value={trend}>
                    {politicalTrendLabels[trend]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="md:w-40">
              <FieldLabel htmlFor="plaza-filter-priority">Prioridade</FieldLabel>
              <NativeSelect
                id="plaza-filter-priority"
                value={state.priority ?? ''}
                onChange={(event) =>
                  commitNavigation({
                    priority: event.target.value === 'alta' ? 'alta' : undefined,
                  })
                }
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">Todas</NativeSelectOption>
                <NativeSelectOption value="alta">Prioritárias</NativeSelectOption>
              </NativeSelect>
            </Field>
          </>
        ) : null}
        {hasActiveFilters ? (
          <div className="flex shrink-0 gap-2 md:self-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                clearDebounce()
                setSearch('')
                startTransition(() => {
                  router.replace('/campanha/pracas', { scroll: false })
                })
              }}
            >
              Limpar
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  )
}
