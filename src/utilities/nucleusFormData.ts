import 'server-only'

import {
  bahiaIdentityTerritories,
  type BahiaIdentityTerritory,
  isBahiaMunicipality,
  validateBahiaTerritoryPair,
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
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { parseTseZoneNumbers } from '@/utilities/tseZone'

const parseZoneNumbers = (value: string | undefined): Array<{ zoneNumber: number }> | undefined =>
  value ? parseTseZoneNumbers(value).map((zoneNumber) => ({ zoneNumber })) : undefined

const parseSharedNucleusFormData = (formData: FormData) => {
  const organizationKind = optionalFormText(formData, 'organizationKind')
  const sectorKind = optionalFormText(formData, 'sectorKind')
  const region = optionalFormText(formData, 'region')
  const city = optionalFormText(formData, 'city')
  const partnerName = optionalFormText(formData, 'partnerName')

  return {
    name: optionalFormText(formData, 'name') ?? '',
    region: region as BahiaIdentityTerritory | undefined,
    city,
    neighborhood: city ? optionalFormText(formData, 'neighborhood') : undefined,
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
  territory: { region?: string; city?: string; locality?: string },
  { requireGeography }: { requireGeography: boolean },
) => {
  if (territory.region && !bahiaIdentityTerritories.includes(territory.region as never)) {
    throw new FormDataBoundaryError('region', 'Território de identidade inválido.')
  }
  if (territory.city && !isBahiaMunicipality(territory.city)) {
    throw new FormDataBoundaryError('city', 'Município inválido.')
  }
  if (!validateBahiaTerritoryPair(territory.region as BahiaIdentityTerritory, territory.city)) {
    throw new FormDataBoundaryError(
      'city',
      'O município não pertence ao território de identidade selecionado.',
    )
  }
  if (requireGeography && !territory.region && !territory.city && !territory.locality) {
    throw new FormDataBoundaryError(
      'city',
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
    region: shared.region ?? null,
    city: shared.city ?? null,
    neighborhood: shared.neighborhood ?? null,
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
