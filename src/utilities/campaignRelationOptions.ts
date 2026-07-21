import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/RelationMultiSelect'
import type { CampaignUser } from '@/payload-types'

/** Plazas the actor may operate on (coordinator: all 436; advisor: administered). */
export const loadPlazaOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs.map((plaza) => ({ id: plaza.id, name: plaza.name }))
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
