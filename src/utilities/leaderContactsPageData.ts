import 'server-only'

import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { primaryPhoneOf } from '@/lib/phone'
import type { CampaignUser, Contact, Municipality } from '@/payload-types'
import { getEngagedLeaderMunicipalityIds } from '@/utilities/campaignAccess'
import { getSupporterRegistrationConsent } from '@/utilities/campaignConsent'

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
    phone: typeof contact === 'object' && contact ? primaryPhoneOf(contact.phones) : null,
    city: typeof contact === 'object' && contact ? (contact.city ?? null) : null,
    municipalityName: typeof municipality === 'object' && municipality ? municipality.name : null,
    createdAt: supporter.createdAt,
  }
}

/**
 * Leaders cannot read the municipality collection (lockdown), so their
 * registration scope comes from the engaged leadership's linked municipality
 * IDs — the same scope `canCreateSupporter` enforces on the write path.
 */
const loadLeaderMunicipalityOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const ids = await getEngagedLeaderMunicipalityIds(payload, user.id)
  if (ids.length === 0) return []

  const result = await payload.find({
    collection: 'municipality',
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true },
    // Intentional bypass: scope already derived from the leader's own leadership.
    overrideAccess: true,
  })
  return result.docs.map((municipality) => ({ id: municipality.id, name: municipality.name }))
}

export const loadLeaderContactsPageData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<LeaderContactsPageView> => {
  const [municipalityOptions, registrationConsent, supporters] = await Promise.all([
    loadLeaderMunicipalityOptions(payload, user),
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
