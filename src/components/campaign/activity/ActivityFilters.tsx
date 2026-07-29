'use client'

import Link from 'next/link'

import { CampaignCollapsibleFilterPanel } from '@/components/campaign/shared/CampaignCollapsibleFilterPanel'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useCampaignFilterValues } from '@/components/campaign/shared/useCampaignFilterValues'
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
  const { values, isPending, replaceValues, updateValues } = useCampaignFilterValues({
    committedValues: valuesFromState(state),
    toHref: (next) => {
      const params = buildActivityListSearchParams({
        page: 1,
        tab: state.tab,
        kind: next.kind as ActivityListState['kind'],
        status: next.status as ActivityListState['status'],
        municipality: municipalityIdFromValue(next.municipality),
      })
      const query = params.toString()
      return query ? `/campanha/atividades?${query}` : '/campanha/atividades'
    },
  })

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
        <CampaignCollapsibleFilterPanel
          panelId="activity-filter-controls"
          hasFilters={hasFilters}
          onClear={() => replaceValues({ kind: '', status: '', municipality: '' })}
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
                onChange={(event) =>
                  updateValues((current) => ({ ...current, kind: event.target.value }))
                }
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
                  onChange={(event) =>
                    updateValues((current) => ({ ...current, status: event.target.value }))
                  }
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
                onChange={(event) =>
                  updateValues((current) => ({ ...current, municipality: event.target.value }))
                }
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
        </CampaignCollapsibleFilterPanel>
      </div>
    </div>
  )
}
