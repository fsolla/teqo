'use client'

import { useCampaignListPending } from '@/components/campaign/shared/CampaignListPending'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'

import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
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
  municipality: string
}

const valuesFromState = (state: SupporterListState): FilterValues => ({
  q: state.q ?? '',
  voteIntention: state.voteIntention ?? '',
  city: state.city ?? '',
  municipality: state.municipality ? String(state.municipality) : '',
})

const filterNames = ['voteIntention', 'city', 'municipality'] as const

type FilterFieldsProps = {
  values: FilterValues
  municipalityOptions: RelationOption[]
  updateFilter: (name: (typeof filterNames)[number], value: string) => void
  updateCity: (city: string) => void
}

const FilterFields = ({
  values,
  municipalityOptions,
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
      <FieldLabel htmlFor="supporter-city">Cidade</FieldLabel>
      <StrictCombobox
        id="supporter-city"
        options={municipalityComboboxOptions()}
        value={values.city}
        onValueChange={updateCity}
      />
    </Field>
    <Field>
      <FieldLabel htmlFor="supporter-municipality">Município</FieldLabel>
      <NativeSelect
        id="supporter-municipality"
        name="municipality"
        value={values.municipality}
        onChange={(event) => updateFilter('municipality', event.target.value)}
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
  </form>
)

export const SupporterFilters = ({
  state,
  municipalityOptions,
}: {
  state: SupporterListState
  municipalityOptions: RelationOption[]
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const initialValues = valuesFromState(state)
  const valuesRef = useRef(initialValues)
  const [values, setValues] = useState(initialValues)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const sharedPending = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  // Prefer the page-level boundary so the results region dims together.
  const isPending = sharedPending?.isPending ?? isLocalPending
  const startTransition = sharedPending?.startTransition ?? startLocalTransition

  const replaceValues = (nextValues: FilterValues) => {
    valuesRef.current = nextValues
    setValues(nextValues)
    const params = buildSupporterListSearchParams({
      page: 1,
      q: nextValues.q,
      voteIntention: nextValues.voteIntention as SupporterListState['voteIntention'],
      city: nextValues.city,
      municipality: nextValues.municipality ? Number(nextValues.municipality) : undefined,
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
    const cleared = Object.fromEntries(
      filterNames.map((name) => [name, '']),
    ) as Partial<FilterValues>
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
            municipalityOptions={municipalityOptions}
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
