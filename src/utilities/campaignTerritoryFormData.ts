import 'server-only'

import {
  bahiaIdentityTerritories,
  type BahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import { FormDataBoundaryError, optionalFormText, repeatedFormTexts } from '@/lib/formData'

type CampaignTerritoryEntity = 'núcleo' | 'plano'

export type CampaignTerritoryFormData = {
  regions: BahiaIdentityTerritory[]
  cities: string[]
  neighborhoods: string[]
  locality: string | undefined
  territoryNotes: string | undefined
}

export const parseCampaignTerritoryFields = (formData: FormData): CampaignTerritoryFormData => {
  const cities = repeatedFormTexts(formData, 'cities')
  const regions =
    cities.length > 0
      ? territoriesForCities(cities)
      : (repeatedFormTexts(formData, 'regions') as BahiaIdentityTerritory[])

  return {
    regions,
    cities,
    neighborhoods: cities.length === 1 ? repeatedFormTexts(formData, 'neighborhoods') : [],
    locality: optionalFormText(formData, 'locality'),
    territoryNotes: optionalFormText(formData, 'territoryNotes'),
  }
}

export const validateCampaignTerritoryFormData = (
  territory: CampaignTerritoryFormData,
  {
    entityLabel,
    requireGeography,
  }: { entityLabel: CampaignTerritoryEntity; requireGeography: boolean },
): void => {
  for (const region of territory.regions) {
    if (!bahiaIdentityTerritories.includes(region)) {
      throw new FormDataBoundaryError('regions', 'Território de identidade inválido.')
    }
  }
  for (const city of territory.cities) {
    if (!isBahiaMunicipality(city)) {
      throw new FormDataBoundaryError('cities', 'Município inválido.')
    }
  }
  if (territory.neighborhoods.length > 0 && territory.cities.length !== 1) {
    throw new FormDataBoundaryError(
      'neighborhoods',
      territory.cities.length === 0
        ? 'Informe o município antes do bairro.'
        : 'Bairros só podem ser informados quando há exatamente um município.',
    )
  }
  if (
    requireGeography &&
    territory.regions.length === 0 &&
    territory.cities.length === 0 &&
    !territory.locality
  ) {
    throw new FormDataBoundaryError(
      'cities',
      `Informe o território de identidade, município ou localidade do ${entityLabel}.`,
    )
  }
}
