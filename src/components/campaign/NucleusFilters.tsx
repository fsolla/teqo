'use client'

import { type FormEvent, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'

import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { StrictCombobox } from '@/components/campaign/StrictCombobox'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { territoryForCity } from '@/lib/bahiaTerritories'
import { cn } from '@/lib/utils'
import {
  buildNucleusListSearchParams,
  nucleusListCoverageLabels,
  nucleusListEstimateLabels,
  nucleusPriorityFilterLabel,
  type NucleusListState,
} from '@/utilities/nucleusUi'
import {
  municipalityComboboxOptions,
  territoryComboboxOptions,
} from '@/utilities/territoryComboboxOptions'

type FilterValues = {
  q: string
  region: string
  city: string
  tseZone: string
  coverage: string
  estimate: string
  priority: string
}

const valuesFromState = (state: NucleusListState): FilterValues => ({
  q: state.q ?? '',
  region: state.region ?? '',
  city: state.city ?? '',
  tseZone: state.tseZone ? String(state.tseZone) : '',
  coverage: state.coverage ?? '',
  estimate: state.estimate ?? '',
  priority: state.priority ?? '',
})

const filterNames = ['region', 'city', 'tseZone', 'coverage', 'estimate', 'priority'] as const

type FilterFieldsProps = {
  values: FilterValues
  zoneError?: string
  updateFilter: (name: (typeof filterNames)[number], value: string) => void
  updateTerritory: (region: string) => void
  updateCity: (city: string) => void
}

const FilterFields = ({
  values,
  zoneError,
  updateFilter,
  updateTerritory,
  updateCity,
}: FilterFieldsProps) => (
  <form
    autoComplete="off"
    onSubmit={(event) => event.preventDefault()}
    className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6"
  >
    <Field>
      <FieldLabel htmlFor="nucleus-lookup-a">Território de identidade</FieldLabel>
      <StrictCombobox
        id="nucleus-lookup-a"
        options={territoryComboboxOptions}
        value={values.region}
        onValueChange={updateTerritory}
      />
    </Field>
    <Field>
      <FieldLabel htmlFor="nucleus-lookup-b">Município</FieldLabel>
      <StrictCombobox
        id="nucleus-lookup-b"
        options={municipalityComboboxOptions(values.region)}
        value={values.city}
        onValueChange={updateCity}
      />
    </Field>
    <Field data-invalid={Boolean(zoneError)}>
      <FieldLabel htmlFor="nucleus-tseZone">Nº da ZE</FieldLabel>
      <Input
        id="nucleus-tseZone"
        name="tseZone"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={values.tseZone}
        onChange={(event) => updateFilter('tseZone', event.target.value)}
        onBlur={(event) => updateFilter('tseZone', event.currentTarget.value)}
        aria-invalid={Boolean(zoneError)}
        aria-describedby={zoneError ? 'nucleus-tseZone-error' : undefined}
        className="min-h-11 rounded-[6px]"
      />
      {zoneError ? (
        <FieldError id="nucleus-tseZone-error">{zoneError}</FieldError>
      ) : null}
    </Field>
    <Field>
      <FieldLabel htmlFor="nucleus-coverage">Cobertura</FieldLabel>
      <NativeSelect
        id="nucleus-coverage"
        name="coverage"
        value={values.coverage}
        onChange={(event) => updateFilter('coverage', event.target.value)}
        className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
      >
        <NativeSelectOption value="">Todas</NativeSelectOption>
        <NativeSelectOption value="com_coordenador">
          {nucleusListCoverageLabels.com_coordenador}
        </NativeSelectOption>
        <NativeSelectOption value="sem_coordenador">
          {nucleusListCoverageLabels.sem_coordenador}
        </NativeSelectOption>
      </NativeSelect>
    </Field>
    <Field>
      <FieldLabel htmlFor="nucleus-estimate">Estimativa</FieldLabel>
      <NativeSelect
        id="nucleus-estimate"
        name="estimate"
        value={values.estimate}
        onChange={(event) => updateFilter('estimate', event.target.value)}
        className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
      >
        <NativeSelectOption value="">Todas</NativeSelectOption>
        <NativeSelectOption value="confirmada">
          {nucleusListEstimateLabels.confirmada}
        </NativeSelectOption>
        <NativeSelectOption value="sem_confirmacao">
          {nucleusListEstimateLabels.sem_confirmacao}
        </NativeSelectOption>
      </NativeSelect>
    </Field>
    <Field>
      <FieldLabel htmlFor="nucleus-priority">Prioridade</FieldLabel>
      <NativeSelect
        id="nucleus-priority"
        name="priority"
        value={values.priority}
        onChange={(event) => updateFilter('priority', event.target.value)}
        className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
      >
        <NativeSelectOption value="">Todas</NativeSelectOption>
        <NativeSelectOption value="alta">{nucleusPriorityFilterLabel}</NativeSelectOption>
      </NativeSelect>
    </Field>
  </form>
)

export const NucleusFilters = ({ state }: { state: NucleusListState }) => {
  const router = useRouter()
  const pathname = usePathname()
  const initialValues = valuesFromState(state)
  const valuesRef = useRef(initialValues)
  const [values, setValues] = useState(initialValues)
  const [zoneError, setZoneError] = useState<string>()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const replaceValues = (nextValues: FilterValues) => {
    valuesRef.current = nextValues
    setValues(nextValues)
    const params = buildNucleusListSearchParams({
      page: 1,
      q: nextValues.q,
      region: nextValues.region as NucleusListState['region'],
      city: nextValues.city,
      tseZone: nextValues.tseZone ? Number(nextValues.tseZone) : undefined,
      coverage: nextValues.coverage as NucleusListState['coverage'],
      estimate: nextValues.estimate as NucleusListState['estimate'],
      priority: nextValues.priority as NucleusListState['priority'],
    })
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const updateFilter = (name: (typeof filterNames)[number], value: string) => {
    const nextValues = { ...valuesRef.current, [name]: value }
    if (name === 'tseZone') {
      valuesRef.current = nextValues
      setValues(nextValues)
      if (!value) {
        setZoneError(undefined)
        replaceValues(nextValues)
        return
      }
      const zone = Number(value)
      if (!/^[1-9]\d{0,2}$/.test(value) || !Number.isInteger(zone) || zone < 1 || zone > 999) {
        setZoneError('Informe uma Zona Eleitoral de 1 a 999.')
        return
      }
      setZoneError(undefined)
    }
    replaceValues(nextValues)
  }

  const updateTerritory = (region: string) => {
    const current = valuesRef.current
    const city = current.city && region && territoryForCity(current.city) !== region ? '' : current.city
    replaceValues({ ...current, region, city })
  }

  const updateCity = (city: string) => {
    const current = valuesRef.current
    const region = territoryForCity(city) ?? current.region
    replaceValues({ ...current, city, region })
  }

  const clearFilters = () => {
    const cleared = Object.fromEntries(filterNames.map((name) => [name, ''])) as Partial<FilterValues>
    setZoneError(undefined)
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
            id="nucleus-search"
            label="Buscar núcleo ou número da Zona TSE"
            name="q"
            value={values.q}
            onChange={(event) => {
              const nextValues = { ...valuesRef.current, q: event.target.value }
              valuesRef.current = nextValues
              setValues(nextValues)
            }}
            placeholder="Buscar núcleo ou nº de zona"
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
          aria-controls="nucleus-filter-controls"
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
          id="nucleus-filter-controls"
          className={cn(
            mobileFiltersOpen ? 'block' : 'hidden',
            'border-t p-4 lg:block lg:border-t-0',
          )}
        >
          <p className="mb-4 text-sm text-muted-foreground lg:hidden">
            Cada escolha atualiza os resultados e fica na URL para compartilhamento.
          </p>
          <FilterFields
            values={values}
            zoneError={zoneError}
            updateFilter={updateFilter}
            updateTerritory={updateTerritory}
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
