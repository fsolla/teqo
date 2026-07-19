'use client'

import { useMemo, useState } from 'react'

import { CampaignTerritoryCoreFields } from '@/components/campaign/CampaignTerritoryCoreFields'
import { TerritorySuggestionChips } from '@/components/campaign/TerritorySuggestionChips'
import { TseZoneInput } from '@/components/campaign/TseZoneInput'
import {
  useCampaignTerritoryFieldsState,
  type CampaignTerritoryValues,
} from '@/components/campaign/useCampaignTerritoryFieldsState'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { buildTerritorySuggestions } from '@/lib/territorySuggestions'
import { sortedUniqueZoneNumbers } from '@/utilities/tseZone'
import { fieldError } from '@/utilities/campaignFormFields'

type TerritoryAndZonesValues = CampaignTerritoryValues & {
  tseZones?: number[] | null
}

export const NucleusTerritoryAndZonesFields = ({
  values,
  fieldErrors = {},
}: {
  values?: TerritoryAndZonesValues
  fieldErrors?: Record<string, string[]>
}) => {
  const state = useCampaignTerritoryFieldsState(values)
  const [tseZones, setTseZones] = useState(() => sortedUniqueZoneNumbers(values?.tseZones ?? []))

  const errorFor = (name: string) => fieldError(fieldErrors, name)

  const { zoneSuggestions, citySuggestions, outsideZones } = useMemo(
    () =>
      buildTerritorySuggestions({
        cities: state.cities,
        regions: state.displayRegions,
        tseZones,
      }),
    [state.cities, state.displayRegions, tseZones],
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampaignTerritoryCoreFields
        state={state}
        idPrefix="nucleus"
        fieldErrors={fieldErrors}
        citySuggestions={citySuggestions}
      />

      <Field data-invalid={Boolean(errorFor('tseZones'))} className="sm:col-span-2">
        <FieldLabel htmlFor="tseZoneDraft">Zonas TSE</FieldLabel>
        {zoneSuggestions.length > 0 ? (
          <FieldDescription>
            Zonas sugeridas pelo cadastro oficial do TSE — confira antes de salvar.
          </FieldDescription>
        ) : null}
        <TerritorySuggestionChips
          kind="zone"
          suggestions={zoneSuggestions}
          onAccept={(suggestion) =>
            setTseZones((current) => sortedUniqueZoneNumbers([...current, ...suggestion.zonesToAdd]))
          }
        />
        <TseZoneInput value={tseZones} onChange={setTseZones} error={errorFor('tseZones')} />
        {outsideZones.length > 0 ? (
          <FieldDescription className="text-amber-700 dark:text-amber-400">
            {outsideZones.length === 1
              ? `Zona ${outsideZones[0]} não aparece no cadastro dos municípios/TIs selecionados.`
              : `Zonas ${outsideZones.join(', ')} não aparecem no cadastro dos municípios/TIs selecionados.`}
          </FieldDescription>
        ) : null}
      </Field>
    </div>
  )
}
