import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/RelationMultiSelect'
import type { CampaignUser } from '@/payload-types'

/** Municipalities the actor may operate on (coordinator: all 436; advisor: administered). */
export const loadMunicipalityOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs.map((municipality) => ({ id: municipality.id, name: municipality.name }))
}

export const loadOrganizationOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'organization',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs.map((organization) => ({ id: organization.id, name: organization.name }))
}

export const loadStateDeputyOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'stateDeputy',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, party: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs.map((stateDeputy) => ({
    id: stateDeputy.id,
    name: stateDeputy.party ? `${stateDeputy.name} (${stateDeputy.party})` : stateDeputy.name,
  }))
}
