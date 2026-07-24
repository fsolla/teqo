'use client'

import { useCampaignListPending } from '@/components/campaign/CampaignListPending'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import { normalizedText } from '@/utilities/campaignListUrl'
import {
  buildMunicipalityFiltersKey,
  buildMunicipalityListHref,
  DEFAULT_MUNICIPALITY_LIST_SORT_DIR,
  DEFAULT_MUNICIPALITY_LIST_SORT_KEY,
  municipalityKindLabels,
  municipalityListCoverageLabels,
  municipalityListSortOptions,
  parseMunicipalitySortValue,
  politicalTrendLabels,
  serializeMunicipalitySortValue,
  shouldUpdateMunicipalitySearchUrl,
  type MunicipalityListState,
} from '@/utilities/municipalityUi'

const SEARCH_DEBOUNCE_MS = 1000

type MunicipalityFiltersProps = {
  state: MunicipalityListState
  showStaffFilters: boolean
}

export const MunicipalityFilters = ({ state, showStaffFilters }: MunicipalityFiltersProps) => {
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')
  const sharedPending = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  // Prefer the page-level boundary so the results region dims together.
  const isPending = sharedPending?.isPending ?? isLocalPending
  const startTransition = sharedPending?.startTransition ?? startLocalTransition
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

  const commitNavigation = (patch: Partial<MunicipalityListState>) => {
    clearDebounce()
    const merged: MunicipalityListState = {
      ...state,
      ...patch,
      page: 1,
      q: normalizedText(patch.q !== undefined ? patch.q : search),
    }
    if (buildMunicipalityFiltersKey(merged) === buildMunicipalityFiltersKey({ ...state, page: 1 }))
      return

    startTransition(() => {
      router.replace(buildMunicipalityListHref(merged, 1), { scroll: false })
    })
  }

  const scheduleSearchNavigation = (value: string) => {
    clearDebounce()
    if (!shouldUpdateMunicipalitySearchUrl(value, state.q)) return

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
          id="municipality-search"
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
          <FieldLabel htmlFor="municipality-filter-region">Território de identidade</FieldLabel>
          <NativeSelect
            id="municipality-filter-region"
            value={state.region ?? ''}
            onChange={(event) =>
              commitNavigation({
                region: (event.target.value || undefined) as MunicipalityListState['region'],
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
          <FieldLabel htmlFor="municipality-filter-kind">Tipo</FieldLabel>
          <NativeSelect
            id="municipality-filter-kind"
            value={state.kind ?? ''}
            onChange={(event) =>
              commitNavigation({
                kind: (event.target.value || undefined) as MunicipalityListState['kind'],
              })
            }
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {(
              Object.keys(municipalityKindLabels) as Array<keyof typeof municipalityKindLabels>
            ).map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {municipalityKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {showStaffFilters ? (
          <>
            <Field className="md:w-44">
              <FieldLabel htmlFor="municipality-filter-coverage">Assessoria</FieldLabel>
              <NativeSelect
                id="municipality-filter-coverage"
                value={state.coverage ?? ''}
                onChange={(event) =>
                  commitNavigation({
                    coverage: (event.target.value ||
                      undefined) as MunicipalityListState['coverage'],
                  })
                }
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">Todas</NativeSelectOption>
                {(
                  Object.keys(municipalityListCoverageLabels) as Array<
                    keyof typeof municipalityListCoverageLabels
                  >
                ).map((coverage) => (
                  <NativeSelectOption key={coverage} value={coverage}>
                    {municipalityListCoverageLabels[coverage]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="md:w-44">
              <FieldLabel htmlFor="municipality-filter-trend">Tendência</FieldLabel>
              <NativeSelect
                id="municipality-filter-trend"
                value={state.trend ?? ''}
                onChange={(event) =>
                  commitNavigation({
                    trend: (event.target.value || undefined) as MunicipalityListState['trend'],
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
              <FieldLabel htmlFor="municipality-filter-priority">Prioridade</FieldLabel>
              <NativeSelect
                id="municipality-filter-priority"
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
        <Field className="md:hidden">
          <FieldLabel htmlFor="municipality-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="municipality-sort"
            value={serializeMunicipalitySortValue(
              state.sort ?? DEFAULT_MUNICIPALITY_LIST_SORT_KEY,
              state.dir ?? DEFAULT_MUNICIPALITY_LIST_SORT_DIR,
            )}
            onChange={(event) => {
              const parsed = parseMunicipalitySortValue(event.target.value)
              if (parsed) commitNavigation({ sort: parsed.key, dir: parsed.dir })
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
                  router.replace('/campanha/municipios', { scroll: false })
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
