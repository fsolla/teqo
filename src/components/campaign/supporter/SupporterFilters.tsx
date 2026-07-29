'use client'

import { useEffect, useRef } from 'react'

import { CampaignCollapsibleFilterPanel } from '@/components/campaign/shared/CampaignCollapsibleFilterPanel'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { useCampaignFilterValues } from '@/components/campaign/shared/useCampaignFilterValues'
import { SEARCH_DEBOUNCE_MS } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  buildSupporterListSearchParams,
  supporterVoteIntentionLabels,
  type SupporterListState,
} from '@/utilities/supporter/supporterUi'
import { municipalityComboboxOptions } from '@/utilities/territory/territoryComboboxOptions'

type FilterValues = {
  q: string
  voteIntention: string
  city: string
  municipality: string
}

const valuesFromState = (state: SupporterListState): FilterValues => ({
  q: state.q ?? '',
  voteIntention: state.voteIntention ?? '',
  city: state.city ?? '',
  municipality: state.municipality ? String(state.municipality) : '',
})

const filterNames = ['voteIntention', 'city', 'municipality'] as const

export const SupporterFilters = ({
  state,
  municipalityOptions,
}: {
  state: SupporterListState
  municipalityOptions: RelationOption[]
}) => {
  const { values, isPending, updateValues, setLocalValues } = useCampaignFilterValues({
    committedValues: valuesFromState(state),
    toHref: (next) => {
      const params = buildSupporterListSearchParams({
        page: 1,
        q: next.q,
        voteIntention: next.voteIntention as SupporterListState['voteIntention'],
        city: next.city,
        municipality: next.municipality ? Number(next.municipality) : undefined,
      })
      const query = params.toString()
      return query ? `/campanha/apoiadores?${query}` : '/campanha/apoiadores'
    },
  })

  /**
   * Search-as-you-type (P3-F unified idiom — this shell used to require an
   * explicit submit): the keystroke mirrors locally and the debounce commits,
   * so a re-typed identical value still cancels the pending navigation through
   * the hook's no-op guard instead of firing a second round-trip.
   */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )
  const onSearchChange = (value: string) => {
    setLocalValues((current) => ({ ...current, q: value }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateValues((current) => ({ ...current, q: value.trim() }))
    }, SEARCH_DEBOUNCE_MS)
  }

  const clearFilters = () =>
    updateValues((current) => ({
      ...current,
      ...(Object.fromEntries(filterNames.map((name) => [name, ''])) as Partial<FilterValues>),
    }))

  const hasFilters = filterNames.some((name) => Boolean(values[name]))

  return (
    <div
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      <div role="search">
        <CampaignSearchInput
          id="supporter-search"
          label="Buscar por nome, telefone ou município"
          name="q"
          value={values.q}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome, telefone ou município"
          enterKeyHint="search"
        />
      </div>

      <CampaignCollapsibleFilterPanel
        panelId="supporter-filter-controls"
        hasFilters={hasFilters}
        onClear={clearFilters}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="supporter-voteIntention">Intenção de voto</FieldLabel>
            <NativeSelect
              id="supporter-voteIntention"
              name="voteIntention"
              value={values.voteIntention}
              onChange={(event) =>
                updateValues((current) => ({ ...current, voteIntention: event.target.value }))
              }
              className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {Object.entries(supporterVoteIntentionLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="supporter-city">Cidade</FieldLabel>
            <StrictCombobox
              id="supporter-city"
              options={municipalityComboboxOptions()}
              value={values.city}
              onValueChange={(city) => updateValues((current) => ({ ...current, city }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="supporter-municipality">Município</FieldLabel>
            <NativeSelect
              id="supporter-municipality"
              name="municipality"
              value={values.municipality}
              onChange={(event) =>
                updateValues((current) => ({ ...current, municipality: event.target.value }))
              }
              className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {municipalityOptions.map((municipality) => (
                <NativeSelectOption key={municipality.id} value={String(municipality.id)}>
                  {municipality.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </CampaignCollapsibleFilterPanel>
    </div>
  )
}
