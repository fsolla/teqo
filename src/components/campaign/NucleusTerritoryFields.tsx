'use client'

import { useState } from 'react'

import { StrictCombobox } from '@/components/campaign/StrictCombobox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { territoryForCity } from '@/lib/bahiaTerritories'
import {
  municipalityComboboxOptions,
  territoryComboboxOptions,
} from '@/utilities/territoryComboboxOptions'

type TerritoryValues = {
  region?: string | null
  city?: string | null
  neighborhood?: string | null
}

export const NucleusTerritoryFields = ({
  values,
  fieldErrors = {},
}: {
  values?: TerritoryValues
  fieldErrors?: Record<string, string[]>
}) => {
  const [region, setRegion] = useState(values?.region ?? '')
  const [city, setCity] = useState(values?.city ?? '')
  const [neighborhood, setNeighborhood] = useState(values?.neighborhood ?? '')
  const [regionError, setRegionError] = useState<string>()
  const [cityError, setCityError] = useState<string>()
  const errorFor = (name: string) => fieldErrors[name]?.[0]
  const visibleRegionError = regionError ?? errorFor('region')
  const visibleCityError = cityError ?? errorFor('city')
  const cityOptions = municipalityComboboxOptions(region)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="city" value={city} />
      <Field data-invalid={Boolean(visibleRegionError)}>
        <FieldLabel htmlFor="nucleus-lookup-a">Território de identidade</FieldLabel>
        <StrictCombobox
          id="nucleus-lookup-a"
          options={territoryComboboxOptions}
          value={region}
          onValueChange={(nextRegion) => {
            if (city && nextRegion && territoryForCity(city) !== nextRegion) {
              setCity('')
              setNeighborhood('')
            }
            setRegion(nextRegion)
            setRegionError(undefined)
            setCityError(undefined)
          }}
          onInvalid={() => {
            setRegionError('Selecione um território de identidade válido da Bahia.')
          }}
          error={visibleRegionError}
        />
        {visibleRegionError ? (
          <FieldError id="nucleus-lookup-a-error">{visibleRegionError}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(visibleCityError)}>
        <FieldLabel htmlFor="nucleus-lookup-b">Município</FieldLabel>
        <StrictCombobox
          id="nucleus-lookup-b"
          options={cityOptions}
          value={city}
          onValueChange={(nextCity) => {
            if (nextCity !== city) setNeighborhood('')
            setCity(nextCity)
            setCityError(undefined)
            const nextRegion = territoryForCity(nextCity)
            if (nextRegion) {
              setRegion(nextRegion)
              setRegionError(undefined)
            }
          }}
          onInvalid={() => {
            setNeighborhood('')
            setCityError('Selecione um município válido da Bahia.')
          }}
          error={visibleCityError}
        />
        {visibleCityError ? (
          <FieldError id="nucleus-lookup-b-error">{visibleCityError}</FieldError>
        ) : null}
      </Field>

      <Field data-disabled={!city.trim()} data-invalid={Boolean(errorFor('neighborhood'))}>
        <FieldLabel htmlFor="neighborhood">Bairro</FieldLabel>
        <Input
          id="neighborhood"
          name="neighborhood"
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          disabled={!city.trim()}
          autoComplete="address-level3"
          aria-invalid={Boolean(errorFor('neighborhood'))}
          aria-describedby={errorFor('neighborhood') ? 'neighborhood-error' : undefined}
        />
        {errorFor('neighborhood') ? (
          <FieldError id="neighborhood-error">{errorFor('neighborhood')}</FieldError>
        ) : null}
      </Field>
    </div>
  )
}
