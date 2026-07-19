import 'server-only'

import {
  organizationKinds,
  sectorKinds,
  type NucleusCreateInput,
  type NucleusUpdateInput,
} from '@/lib/schemas/nucleus'
import {
  checkboxFormValue,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  parseCampaignTerritoryFields,
  validateCampaignTerritoryFormData,
} from '@/utilities/campaignTerritoryFormData'
import { parseTseZoneNumbers } from '@/utilities/tseZone'

const parseZoneNumbers = (value: string | undefined): Array<{ zoneNumber: number }> | undefined =>
  value ? parseTseZoneNumbers(value).map((zoneNumber) => ({ zoneNumber })) : undefined

const parseSharedNucleusFormData = (formData: FormData) => {
  const organizationKind = optionalFormText(formData, 'organizationKind')
  const sectorKind = optionalFormText(formData, 'sectorKind')
  const territory = parseCampaignTerritoryFields(formData)
  const partnerName = optionalFormText(formData, 'partnerName')

  return {
    name: optionalFormText(formData, 'name') ?? '',
    ...territory,
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

export const parseNucleusCreateFormData = (formData: FormData): NucleusCreateInput => {
  const shared = parseSharedNucleusFormData(formData)
  validateCampaignTerritoryFormData(shared, { entityLabel: 'núcleo', requireGeography: false })
  const coordinatorIds = repeatedRelationshipFormValues(formData, 'coordinators')

  return {
    ...shared,
    coordinators: coordinatorIds.length ? coordinatorIds : undefined,
  }
}

export const parseNucleusUpdateFormData = (formData: FormData): NucleusUpdateInput => {
  const shared = parseSharedNucleusFormData(formData)
  validateCampaignTerritoryFormData(shared, { entityLabel: 'núcleo', requireGeography: true })
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
