'use client'

import { useMemo, useState } from 'react'
import { XIcon } from 'lucide-react'

import { StrictCombobox } from '@/components/campaign/StrictCombobox'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { territoriesForCities } from '@/lib/bahiaTerritories'
import {
  MAX_NUCLEUS_CITIES,
  MAX_NUCLEUS_NEIGHBORHOODS,
  MAX_NUCLEUS_REGIONS,
} from '@/lib/schemas/nucleus'
import {
  municipalityComboboxOptions,
  territoryComboboxOptions,
} from '@/utilities/territoryComboboxOptions'

type TerritoryValues = {
  regions?: string[] | null
  cities?: string[] | null
  neighborhoods?: string[] | null
}

const uniquePreserveOrder = (values: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

const ChipList = ({
  values,
  onRemove,
  removeLabel,
}: {
  values: string[]
  onRemove: (value: string) => void
  removeLabel: (value: string) => string
}) => (
  <div className="flex flex-wrap gap-1">
    {values.map((value) => (
      <Badge key={value} asChild variant="secondary" className="h-8 gap-1 rounded-sm px-2.5 py-1">
        <button type="button" onClick={() => onRemove(value)} aria-label={removeLabel(value)}>
          <span>{value}</span>
          <XIcon aria-hidden="true" className="size-3" />
        </button>
      </Badge>
    ))}
  </div>
)

export const NucleusTerritoryFields = ({
  values,
  fieldErrors = {},
}: {
  values?: TerritoryValues
  fieldErrors?: Record<string, string[]>
}) => {
  const [regions, setRegions] = useState(() => uniquePreserveOrder(values?.regions ?? []))
  const [cities, setCities] = useState(() => uniquePreserveOrder(values?.cities ?? []))
  const [neighborhoods, setNeighborhoods] = useState(() =>
    uniquePreserveOrder(values?.neighborhoods ?? []),
  )
  const [cityDraft, setCityDraft] = useState('')
  const [regionDraft, setRegionDraft] = useState('')
  const [neighborhoodDraft, setNeighborhoodDraft] = useState('')
  const [regionError, setRegionError] = useState<string>()
  const [cityError, setCityError] = useState<string>()
  const [neighborhoodError, setNeighborhoodError] = useState<string>()

  const errorFor = (name: string) => fieldErrors[name]?.[0]
  const derivedRegions = useMemo(() => territoriesForCities(cities), [cities])
  const displayRegions = cities.length > 0 ? derivedRegions : regions
  const regionsAreDerived = cities.length > 0
  const neighborhoodsEnabled = cities.length === 1

  const visibleRegionError = regionError ?? errorFor('regions')
  const visibleCityError = cityError ?? errorFor('cities')
  const visibleNeighborhoodError = neighborhoodError ?? errorFor('neighborhoods')

  const availableCityOptions = municipalityComboboxOptions().filter(
    (option) => !cities.includes(option.value),
  )
  const availableRegionOptions = territoryComboboxOptions.filter(
    (option) => !regions.includes(option.value),
  )

  const addCity = (nextCity: string) => {
    if (!nextCity) return
    if (cities.length >= MAX_NUCLEUS_CITIES) {
      setCityError(`Informe no máximo ${MAX_NUCLEUS_CITIES} municípios.`)
      setCityDraft('')
      return
    }
    setCities((current) => {
      const next = uniquePreserveOrder([...current, nextCity])
      if (next.length !== 1) setNeighborhoods([])
      return next
    })
    setCityDraft('')
    setCityError(undefined)
    setRegionError(undefined)
  }

  const removeCity = (city: string) => {
    setCities((current) => {
      const next = current.filter((item) => item !== city)
      if (next.length !== 1) setNeighborhoods([])
      return next
    })
    setCityError(undefined)
  }

  const addRegion = (nextRegion: string) => {
    if (!nextRegion || regionsAreDerived) return
    if (regions.length >= MAX_NUCLEUS_REGIONS) {
      setRegionError(`Informe no máximo ${MAX_NUCLEUS_REGIONS} territórios.`)
      setRegionDraft('')
      return
    }
    setRegions((current) => uniquePreserveOrder([...current, nextRegion]))
    setRegionDraft('')
    setRegionError(undefined)
  }

  const removeRegion = (region: string) => {
    if (regionsAreDerived) return
    setRegions((current) => current.filter((item) => item !== region))
    setRegionError(undefined)
  }

  const commitNeighborhood = (value: string) => {
    if (!neighborhoodsEnabled) {
      setNeighborhoodDraft('')
      return
    }
    const trimmed = value.trim()
    if (!trimmed) {
      setNeighborhoodDraft('')
      return
    }
    if (neighborhoods.length >= MAX_NUCLEUS_NEIGHBORHOODS) {
      setNeighborhoodError(`Informe no máximo ${MAX_NUCLEUS_NEIGHBORHOODS} bairros.`)
      setNeighborhoodDraft('')
      return
    }
    setNeighborhoods((current) => uniquePreserveOrder([...current, trimmed]))
    setNeighborhoodDraft('')
    setNeighborhoodError(undefined)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cities.map((city) => (
        <input key={`city-${city}`} type="hidden" name="cities" value={city} />
      ))}
      {!regionsAreDerived
        ? regions.map((region) => (
            <input key={`region-${region}`} type="hidden" name="regions" value={region} />
          ))
        : null}
      {neighborhoodsEnabled
        ? neighborhoods.map((neighborhood) => (
            <input
              key={`neighborhood-${neighborhood}`}
              type="hidden"
              name="neighborhoods"
              value={neighborhood}
            />
          ))
        : null}

      <Field data-invalid={Boolean(visibleRegionError)} className="sm:col-span-2">
        <FieldLabel htmlFor="nucleus-lookup-a">Territórios de identidade</FieldLabel>
        {displayRegions.length ? (
          <ChipList
            values={displayRegions}
            onRemove={removeRegion}
            removeLabel={(region) => `Remover território ${region}`}
          />
        ) : null}
        {regionsAreDerived ? (
          <FieldDescription>
            Derivados automaticamente dos municípios selecionados. Remova municípios para editar
            territórios manualmente.
          </FieldDescription>
        ) : (
          <StrictCombobox
            id="nucleus-lookup-a"
            options={availableRegionOptions}
            value={regionDraft}
            onValueChange={(nextRegion) => {
              if (nextRegion) addRegion(nextRegion)
              else setRegionDraft('')
            }}
            onInvalid={() => {
              setRegionError('Selecione um território de identidade válido da Bahia.')
            }}
            error={visibleRegionError}
          />
        )}
        {visibleRegionError ? (
          <FieldError id="nucleus-lookup-a-error">{visibleRegionError}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(visibleCityError)} className="sm:col-span-2">
        <FieldLabel htmlFor="nucleus-lookup-b">Municípios</FieldLabel>
        {cities.length ? (
          <ChipList
            values={cities}
            onRemove={removeCity}
            removeLabel={(city) => `Remover município ${city}`}
          />
        ) : null}
        <StrictCombobox
          id="nucleus-lookup-b"
          options={availableCityOptions}
          value={cityDraft}
          onValueChange={(nextCity) => {
            if (nextCity) addCity(nextCity)
            else setCityDraft('')
          }}
          onInvalid={() => {
            setCityError('Selecione um município válido da Bahia.')
          }}
          error={visibleCityError}
        />
        <FieldDescription>
          Selecione um ou mais municípios. Territórios são derivados automaticamente; bairros só
          ficam disponíveis com exatamente um município.
        </FieldDescription>
        {visibleCityError ? (
          <FieldError id="nucleus-lookup-b-error">{visibleCityError}</FieldError>
        ) : null}
      </Field>

      <Field
        data-disabled={!neighborhoodsEnabled}
        data-invalid={Boolean(visibleNeighborhoodError)}
        className="sm:col-span-2"
      >
        <FieldLabel htmlFor="neighborhoodDraft">Bairros</FieldLabel>
        {neighborhoodsEnabled && neighborhoods.length ? (
          <ChipList
            values={neighborhoods}
            onRemove={(neighborhood) =>
              setNeighborhoods((current) => current.filter((item) => item !== neighborhood))
            }
            removeLabel={(neighborhood) => `Remover bairro ${neighborhood}`}
          />
        ) : null}
        <InputGroup className="min-h-11 h-auto flex-wrap gap-1 p-1">
          <InputGroupInput
            id="neighborhoodDraft"
            value={neighborhoodDraft}
            disabled={!neighborhoodsEnabled}
            placeholder={
              neighborhoodsEnabled
                ? 'Digite um bairro e pressione Enter'
                : 'Selecione exatamente um município para informar bairros'
            }
            autoComplete="address-level3"
            aria-invalid={Boolean(visibleNeighborhoodError)}
            aria-describedby={
              visibleNeighborhoodError ? 'neighborhoods-error' : 'neighborhoods-description'
            }
            className="min-w-48"
            onChange={(event) => {
              setNeighborhoodDraft(event.target.value)
              setNeighborhoodError(undefined)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitNeighborhood(neighborhoodDraft)
              } else if (
                event.key === 'Backspace' &&
                !neighborhoodDraft &&
                neighborhoods.length > 0
              ) {
                setNeighborhoods((current) => current.slice(0, -1))
              }
            }}
            onBlur={() => commitNeighborhood(neighborhoodDraft)}
          />
        </InputGroup>
        <FieldDescription id="neighborhoods-description">
          Use Enter para adicionar. Disponível somente quando há exatamente um município.
        </FieldDescription>
        {visibleNeighborhoodError ? (
          <FieldError id="neighborhoods-error">{visibleNeighborhoodError}</FieldError>
        ) : null}
      </Field>
    </div>
  )
}
