'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { bahiaIdentityTerritories } from '@/lib/bahiaTerritories'
import {
  buildPlazaListHref,
  plazaKindLabels,
  plazaListCoverageLabels,
  politicalTrendLabels,
  type PlazaListState,
} from '@/utilities/plazaUi'

type PlazaFiltersProps = {
  state: PlazaListState
  showStaffFilters: boolean
}

export const PlazaFilters = ({ state, showStaffFilters }: PlazaFiltersProps) => {
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')

  const navigate = (next: PlazaListState) => {
    router.replace(buildPlazaListHref({ ...next, page: 1 }, 1), { scroll: false })
  }

  const hasActiveFilters = Boolean(
    state.q || state.region || state.kind || state.coverage || state.priority || state.trend,
  )

  return (
    <form
      role="search"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        navigate({ ...state, q: search.trim() || undefined })
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="plaza-search"
          label="Buscar Praça"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Field className="md:w-56">
          <FieldLabel htmlFor="plaza-filter-region">Território de identidade</FieldLabel>
          <NativeSelect
            id="plaza-filter-region"
            value={state.region ?? ''}
            onChange={(event) =>
              navigate({
                ...state,
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
              navigate({
                ...state,
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
                  navigate({
                    ...state,
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
                  navigate({
                    ...state,
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
                  navigate({
                    ...state,
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
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="min-h-11">
            Buscar
          </Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setSearch('')
                router.replace('/campanha/pracas', { scroll: false })
              }}
            >
              Limpar
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
