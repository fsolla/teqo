import 'server-only'

import {
  bahiaIdentityTerritories,
  type BahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import {
  organizationKinds,
  sectorKinds,
  type NucleusCreateInput,
  type NucleusUpdateInput,
} from '@/lib/schemas/nucleus'
import {
  checkboxFormValue,
  FormDataBoundaryError,
  optionalFormText,
  repeatedFormTexts,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { parseTseZoneNumbers } from '@/utilities/tseZone'

const parseZoneNumbers = (value: string | undefined): Array<{ zoneNumber: number }> | undefined =>
  value ? parseTseZoneNumbers(value).map((zoneNumber) => ({ zoneNumber })) : undefined

const parseSharedNucleusFormData = (formData: FormData) => {
  const organizationKind = optionalFormText(formData, 'organizationKind')
  const sectorKind = optionalFormText(formData, 'sectorKind')
  const cities = repeatedFormTexts(formData, 'cities')
  const regions =
    cities.length > 0
      ? territoriesForCities(cities)
      : (repeatedFormTexts(formData, 'regions') as BahiaIdentityTerritory[])
  const neighborhoods = cities.length === 1 ? repeatedFormTexts(formData, 'neighborhoods') : []
  const partnerName = optionalFormText(formData, 'partnerName')

  return {
    name: optionalFormText(formData, 'name') ?? '',
    regions,
    cities,
    neighborhoods,
    locality: optionalFormText(formData, 'locality'),
    territoryNotes: optionalFormText(formData, 'territoryNotes'),
    organizationKind: organizationKind as (typeof organizationKinds)[number],
    organizationLabel: optionalFormText(formData, 'organizationLabel'),
    sectorKind: sectorKind ? (sectorKind as (typeof sectorKinds)[number]) : undefined,
    tseZones: parseZoneNumbers(optionalFormText(formData, 'tseZones')),
    ticketAlliance: partnerName
      ? {
          partnerName,
          office: optionalFormText(formData, 'partnerOffice'),
          isCampaignPartner: checkboxFormValue(formData, 'isCampaignPartner'),
          notes: optionalFormText(formData, 'partnerNotes'),
        }
      : undefined,
  }
}

const validateTerritoryFormData = (
  territory: {
    regions: string[]
    cities: string[]
    neighborhoods: string[]
    locality?: string
  },
  { requireGeography }: { requireGeography: boolean },
) => {
  for (const region of territory.regions) {
    if (!bahiaIdentityTerritories.includes(region as never)) {
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
      'Informe o território de identidade, município ou localidade do núcleo.',
    )
  }
}

export const parseNucleusCreateFormData = (formData: FormData): NucleusCreateInput => {
  const shared = parseSharedNucleusFormData(formData)
  validateTerritoryFormData(shared, { requireGeography: false })
  const coordinatorIds = repeatedRelationshipFormValues(formData, 'coordinators')

  return {
    ...shared,
    coordinators: coordinatorIds.length ? coordinatorIds : undefined,
  }
}

export const parseNucleusUpdateFormData = (formData: FormData): NucleusUpdateInput => {
  const shared = parseSharedNucleusFormData(formData)
  validateTerritoryFormData(shared, { requireGeography: true })
  const partnerName = optionalFormText(formData, 'partnerName')

  return {
    ...shared,
    id: requiredRelationshipFormValue(formData, 'id'),
    regions: shared.regions,
    cities: shared.cities,
    neighborhoods: shared.neighborhoods,
    locality: shared.locality ?? null,
    territoryNotes: shared.territoryNotes ?? null,
    organizationLabel: shared.organizationLabel ?? null,
    sectorKind: shared.sectorKind ?? null,
    tseZones: shared.tseZones ?? [],
    ticketAlliance: partnerName
      ? shared.ticketAlliance
      : {
          partnerName: null,
          office: null,
          isCampaignPartner: false,
          notes: null,
        },
  }
}
