import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/RelationMultiSelect'
import type { CampaignUser, Contact, Municipality } from '@/payload-types'
import { getSupporterRegistrationConsent } from '@/utilities/campaignConsent'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'

export type LeaderContactListItem = {
  id: number
  name: string
  phone: string | null
  city: string | null
  municipalityName: string | null
  createdAt: string
}

export type LeaderContactsPageView = {
  municipalityOptions: RelationOption[]
  defaultMunicipalityId: number | null
  showMunicipalitySelect: boolean
  registrationConsentConfigured: boolean
  contacts: LeaderContactListItem[]
}

const toLeaderContactListItem = (supporter: {
  id: number
  contact: Contact | number
  municipality?: Municipality | number | null
  createdAt: string
}): LeaderContactListItem => {
  const contact = supporter.contact as Contact | number | null | undefined
  const municipality = supporter.municipality as Municipality | number | null | undefined

  return {
    id: supporter.id,
    name: typeof contact === 'object' && contact ? contact.name : 'Contato',
    phone: typeof contact === 'object' && contact ? (contact.phone ?? null) : null,
    city: typeof contact === 'object' && contact ? (contact.city ?? null) : null,
    municipalityName:
      typeof municipality === 'object' && municipality ? municipality.name : null,
    createdAt: supporter.createdAt,
  }
}

export const loadLeaderContactsPageData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<LeaderContactsPageView> => {
  const [municipalityOptions, registrationConsent, supporters] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    getSupporterRegistrationConsent(payload),
    payload.find({
      collection: 'supporter',
      depth: 1,
      limit: 100,
      pagination: false,
      sort: '-createdAt',
      select: {
        contact: true,
        municipality: true,
        createdAt: true,
      },
      user,
      overrideAccess: false,
    }),
  ])

  const defaultMunicipalityId =
    municipalityOptions.length === 1 ? (municipalityOptions[0]?.id ?? null) : null

  return {
    municipalityOptions,
    defaultMunicipalityId,
    showMunicipalitySelect: municipalityOptions.length > 1,
    registrationConsentConfigured: Boolean(registrationConsent),
    contacts: supporters.docs.map(toLeaderContactListItem),
  }
}
