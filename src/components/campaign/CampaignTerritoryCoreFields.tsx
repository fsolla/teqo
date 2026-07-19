'use client'

import { useMemo } from 'react'
import { XIcon } from 'lucide-react'

import { StrictCombobox } from '@/components/campaign/StrictCombobox'
import { TerritorySuggestionChips } from '@/components/campaign/TerritorySuggestionChips'
import type { CampaignTerritoryFieldsState } from '@/components/campaign/useCampaignTerritoryFieldsState'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { buildTerritorySuggestions } from '@/lib/territorySuggestions'
import { fieldError } from '@/utilities/campaignFormFields'

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

export const CampaignTerritoryCoreFields = ({
  state,
  idPrefix,
  fieldErrors = {},
  citySuggestions: citySuggestionsOverride,
}: {
  state: CampaignTerritoryFieldsState
  idPrefix: string
  fieldErrors?: Record<string, string[]>
  citySuggestions?: ReturnType<typeof buildTerritorySuggestions>['citySuggestions']
}) => {
  const errorFor = (name: string) => fieldError(fieldErrors, name)
  const {
    regions,
    cities,
    neighborhoods,
    cityDraft,
    regionDraft,
    neighborhoodDraft,
    regionError,
    cityError,
    neighborhoodError,
    setCityDraft,
    setRegionDraft,
    setNeighborhoodDraft,
    setRegionError,
    setCityError,
    setNeighborhoodError,
    displayRegions,
    regionsAreDerived,
    neighborhoodsEnabled,
    availableCityOptions,
    availableRegionOptions,
    addCity,
    removeCity,
    addRegion,
    removeRegion,
    commitNeighborhood,
    removeNeighborhood,
  } = state

  const citySuggestions = useMemo(() => {
    if (citySuggestionsOverride) return citySuggestionsOverride
    return buildTerritorySuggestions({
      cities,
      regions: displayRegions,
      tseZones: [],
    }).citySuggestions
  }, [citySuggestionsOverride, cities, displayRegions])

  const visibleRegionError = regionError ?? errorFor('regions')
  const visibleCityError = cityError ?? errorFor('cities')
  const visibleNeighborhoodError = neighborhoodError ?? errorFor('neighborhoods')

  const regionFieldId = `${idPrefix}-lookup-a`
  const cityFieldId = `${idPrefix}-lookup-b`
  const neighborhoodFieldId = `${idPrefix}-neighborhoodDraft`

  return (
    <>
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
        <FieldLabel htmlFor={regionFieldId}>Territórios de identidade</FieldLabel>
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
            id={regionFieldId}
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
          <FieldError id={`${regionFieldId}-error`}>{visibleRegionError}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(visibleCityError)} className="sm:col-span-2">
        <FieldLabel htmlFor={cityFieldId}>Municípios</FieldLabel>
        <TerritorySuggestionChips
          kind="city"
          suggestions={citySuggestions}
          onAccept={(suggestion) => addCity(suggestion.city)}
        />
        {cities.length ? (
          <ChipList
            values={cities}
            onRemove={removeCity}
            removeLabel={(city) => `Remover município ${city}`}
          />
        ) : null}
        <StrictCombobox
          id={cityFieldId}
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
          <FieldError id={`${cityFieldId}-error`}>{visibleCityError}</FieldError>
        ) : null}
      </Field>

      <Field
        data-disabled={!neighborhoodsEnabled}
        data-invalid={Boolean(visibleNeighborhoodError)}
        className="sm:col-span-2"
      >
        <FieldLabel htmlFor={neighborhoodFieldId}>Bairros</FieldLabel>
        {neighborhoodsEnabled && neighborhoods.length ? (
          <ChipList
            values={neighborhoods}
            onRemove={removeNeighborhood}
            removeLabel={(neighborhood) => `Remover bairro ${neighborhood}`}
          />
        ) : null}
        <InputGroup className="min-h-11 h-auto flex-wrap gap-1 p-1">
          <InputGroupInput
            id={neighborhoodFieldId}
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
              visibleNeighborhoodError
                ? `${idPrefix}-neighborhoods-error`
                : `${idPrefix}-neighborhoods-description`
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
                removeNeighborhood(neighborhoods[neighborhoods.length - 1]!)
              }
            }}
            onBlur={() => commitNeighborhood(neighborhoodDraft)}
          />
        </InputGroup>
        <FieldDescription id={`${idPrefix}-neighborhoods-description`}>
          Use Enter para adicionar. Disponível somente quando há exatamente um município.
        </FieldDescription>
        {visibleNeighborhoodError ? (
          <FieldError id={`${idPrefix}-neighborhoods-error`}>{visibleNeighborhoodError}</FieldError>
        ) : null}
      </Field>
    </>
  )
}
