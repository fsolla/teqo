'use client'

import { type FormEvent, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { StrictCombobox } from '@/components/campaign/StrictCombobox'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { SupporterNucleusOption } from '@/utilities/supporterViewModels'
import {
  buildSupporterListSearchParams,
  supporterVoteIntentionLabels,
  type SupporterListState,
} from '@/utilities/supporterUi'
import { municipalityComboboxOptions } from '@/utilities/territoryComboboxOptions'

type FilterValues = {
  q: string
  voteIntention: string
  city: string
  nucleus: string
}

const valuesFromState = (state: SupporterListState): FilterValues => ({
  q: state.q ?? '',
  voteIntention: state.voteIntention ?? '',
  city: state.city ?? '',
  nucleus: state.nucleus ? String(state.nucleus) : '',
})

const filterNames = ['voteIntention', 'city', 'nucleus'] as const

type FilterFieldsProps = {
  values: FilterValues
  nucleusOptions: SupporterNucleusOption[]
  updateFilter: (name: (typeof filterNames)[number], value: string) => void
  updateCity: (city: string) => void
}

const FilterFields = ({
  values,
  nucleusOptions,
  updateFilter,
  updateCity,
}: FilterFieldsProps) => (
  <form
    autoComplete="off"
    onSubmit={(event) => event.preventDefault()}
    className="grid gap-4 lg:grid-cols-3"
  >
    <Field>
      <FieldLabel htmlFor="supporter-voteIntention">Intenção de voto</FieldLabel>
      <NativeSelect
        id="supporter-voteIntention"
        name="voteIntention"
        value={values.voteIntention}
        onChange={(event) => updateFilter('voteIntention', event.target.value)}
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
      <FieldLabel htmlFor="supporter-city">Município</FieldLabel>
      <StrictCombobox
        id="supporter-city"
        options={municipalityComboboxOptions()}
        value={values.city}
        onValueChange={updateCity}
      />
    </Field>
    <Field>
      <FieldLabel htmlFor="supporter-nucleus">Núcleo</FieldLabel>
      <NativeSelect
        id="supporter-nucleus"
        name="nucleus"
        value={values.nucleus}
        onChange={(event) => updateFilter('nucleus', event.target.value)}
        className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
      >
        <NativeSelectOption value="">Todos</NativeSelectOption>
        {nucleusOptions.map((nucleus) => (
          <NativeSelectOption key={nucleus.id} value={String(nucleus.id)}>
            {nucleus.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  </form>
)

export const SupporterFilters = ({
  state,
  nucleusOptions,
}: {
  state: SupporterListState
  nucleusOptions: SupporterNucleusOption[]
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const initialValues = valuesFromState(state)
  const valuesRef = useRef(initialValues)
  const [values, setValues] = useState(initialValues)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const replaceValues = (nextValues: FilterValues) => {
    valuesRef.current = nextValues
    setValues(nextValues)
    const params = buildSupporterListSearchParams({
      page: 1,
      q: nextValues.q,
      voteIntention: nextValues.voteIntention as SupporterListState['voteIntention'],
      city: nextValues.city,
      nucleus: nextValues.nucleus ? Number(nextValues.nucleus) : undefined,
    })
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const updateFilter = (name: (typeof filterNames)[number], value: string) => {
    replaceValues({ ...valuesRef.current, [name]: value })
  }

  const updateCity = (city: string) => {
    replaceValues({ ...valuesRef.current, city })
  }

  const clearFilters = () => {
    const cleared = Object.fromEntries(filterNames.map((name) => [name, ''])) as Partial<FilterValues>
    replaceValues({ ...valuesRef.current, ...cleared })
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    replaceValues({ ...valuesRef.current, q: valuesRef.current.q.trim() })
  }

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
      <div>
        <form onSubmit={submitSearch} className="flex gap-2">
          <CampaignSearchInput
            id="supporter-search"
            label="Buscar por nome, telefone ou município"
            name="q"
            value={values.q}
            onChange={(event) => {
              const nextValues = { ...valuesRef.current, q: event.target.value }
              valuesRef.current = nextValues
              setValues(nextValues)
            }}
            placeholder="Buscar por nome, telefone ou município"
            enterKeyHint="search"
          />
          <Button type="submit" className="min-h-11 rounded-[6px]" disabled={isPending}>
            Buscar
          </Button>
        </form>
      </div>

      <div className="rounded-[6px] border bg-card">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full justify-start rounded-[6px] px-3 lg:hidden"
          aria-expanded={mobileFiltersOpen}
          aria-controls="supporter-filter-controls"
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <FilterIcon data-icon="inline-start" aria-hidden="true" />
          <span>Filtros</span>
          <ChevronDownIcon
            data-icon="inline-end"
            className="ml-auto transition-transform group-aria-expanded/button:rotate-180"
            aria-hidden="true"
          />
        </Button>
        <div
          id="supporter-filter-controls"
          className={cn(
            mobileFiltersOpen ? 'block' : 'hidden',
            'border-t p-4 lg:block lg:border-t-0',
          )}
        >
          <FilterFields
            values={values}
            nucleusOptions={nucleusOptions}
            updateFilter={updateFilter}
            updateCity={updateCity}
          />
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
  )
}
