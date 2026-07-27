'use client'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { activityKindLabels, activityStatusLabels } from '@/lib/schemas/activity'
import { cn } from '@/lib/utils'
import {
  activityTabLabels,
  activityTabs,
  buildActivityListSearchParams,
  type ActivityListState,
  type ActivityTab,
} from '@/utilities/activityUi'

type FilterValues = {
  kind: string
  status: string
  municipality: string
}

const valuesFromState = (state: ActivityListState): FilterValues => ({
  kind: state.kind ?? '',
  status: state.status ?? '',
  municipality: state.municipality ? String(state.municipality) : '',
})

const municipalityIdFromValue = (value: string): number | undefined => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

const buildTabHref = (state: ActivityListState, tab: ActivityTab): string => {
  const params = buildActivityListSearchParams({
    page: 1,
    tab,
    kind: state.kind,
    status: tab === 'todos' ? state.status : undefined,
    municipality: state.municipality,
  })
  const query = params.toString()
  return query ? `/campanha/atividades?${query}` : '/campanha/atividades'
}

const ActivityTabSwitch = ({ state }: { state: ActivityListState }) => (
  <nav aria-label="Janela de atividades" className="flex flex-wrap gap-2">
    {activityTabs.map((tab) => {
      const active = tab === state.tab
      return (
        <Button
          key={tab}
          asChild
          variant={active ? 'default' : 'outline'}
          className="min-h-11 rounded-[6px]"
        >
          <Link href={buildTabHref(state, tab)} aria-current={active ? 'page' : undefined}>
            {activityTabLabels[tab]}
          </Link>
        </Button>
      )
    })}
  </nav>
)

export const ActivityFilters = ({
  state,
  municipalityOptions,
}: {
  state: ActivityListState
  municipalityOptions: RelationOption[]
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const initialValues = valuesFromState(state)
  const valuesRef = useRef(initialValues)
  const [values, setValues] = useState(initialValues)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const { isPending, startTransition } = useCampaignListTransition()

  const replaceValues = (nextValues: FilterValues) => {
    valuesRef.current = nextValues
    setValues(nextValues)
    const params = buildActivityListSearchParams({
      page: 1,
      tab: state.tab,
      kind: nextValues.kind as ActivityListState['kind'],
      status: nextValues.status as ActivityListState['status'],
      municipality: municipalityIdFromValue(nextValues.municipality),
    })
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const updateKind = (kind: string) => replaceValues({ ...valuesRef.current, kind })
  const updateStatus = (status: string) => replaceValues({ ...valuesRef.current, status })
  const updateMunicipality = (municipality: string) =>
    replaceValues({ ...valuesRef.current, municipality })

  const clearFilters = () => replaceValues({ kind: '', status: '', municipality: '' })

  const hasFilters = Object.values(values).some(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <ActivityTabSwitch state={state} />

      <div
        className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
        data-pending={isPending}
        aria-busy={isPending}
      >
        <p className="sr-only" aria-live="polite">
          {isPending ? 'Atualizando resultados…' : ''}
        </p>
        <div className="rounded-[6px] border bg-card">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full justify-start rounded-[6px] px-3 lg:hidden"
            aria-expanded={mobileFiltersOpen}
            aria-controls="activity-filter-controls"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <FilterIcon data-icon="inline-start" aria-hidden="true" />
            <span>Filtros</span>
            <ChevronDownIcon data-icon="inline-end" className="ml-auto" aria-hidden="true" />
          </Button>
          <div
            id="activity-filter-controls"
            className={cn(
              mobileFiltersOpen ? 'block' : 'hidden',
              'border-t p-4 lg:block lg:border-t-0',
            )}
          >
            <div
              className={cn(
                'grid gap-4',
                state.tab === 'todos' ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
              )}
            >
              <Field>
                <FieldLabel htmlFor="activity-kind">Tipo de atividade</FieldLabel>
                <NativeSelect
                  id="activity-kind"
                  value={values.kind}
                  onChange={(event) => updateKind(event.target.value)}
                  className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
                >
                  <NativeSelectOption value="">Todos os tipos</NativeSelectOption>
                  {Object.entries(activityKindLabels).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {state.tab === 'todos' ? (
                <Field>
                  <FieldLabel htmlFor="activity-status">Status</FieldLabel>
                  <NativeSelect
                    id="activity-status"
                    value={values.status}
                    onChange={(event) => updateStatus(event.target.value)}
                    className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
                  >
                    <NativeSelectOption value="">Todos os status</NativeSelectOption>
                    {Object.entries(activityStatusLabels).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="activity-municipality">Município</FieldLabel>
                <NativeSelect
                  id="activity-municipality"
                  value={values.municipality}
                  onChange={(event) => updateMunicipality(event.target.value)}
                  className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
                >
                  <NativeSelectOption value="">Todos os municípios</NativeSelectOption>
                  {municipalityOptions.map((option) => (
                    <NativeSelectOption key={option.id} value={String(option.id)}>
                      {option.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {hasFilters ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 rounded-[6px]"
                  onClick={clearFilters}
                >
                  <XIcon data-icon="inline-start" aria-hidden="true" />
                  Limpar filtros
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
