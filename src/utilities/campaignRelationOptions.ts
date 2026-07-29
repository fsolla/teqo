import 'server-only'

import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { populatedContactName, relationshipId } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'

export type ActivityRelationOption = RelationOption & {
  municipalityId: number
}

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

export const loadActivityOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<ActivityRelationOption[]> => {
  const result = await payload.find({
    collection: 'activity',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'title',
    select: { title: true, municipality: true },
    where: {},
    user,
    overrideAccess: false,
  })

  return result.docs.flatMap((activity) => {
    const municipalityId = relationshipId(activity.municipality)
    return municipalityId ? [{ id: activity.id, name: activity.title, municipalityId }] : []
  })
}

/**
 * `name` folds in the party for select/typeahead disambiguation (e.g.
 * `RelationMultiSelect`); `plainName`/`party`/`slug` ride along so cell-level
 * consumers (B31's "Dobradinhas" column) can build a `StateDeputySummary`
 * chip for an optimistic add and link to `/campanha/dobradinhas/<slug>`
 * without a second catalog fetch.
 */
export type StateDeputyRelationOption = RelationOption & {
  plainName: string
  party: string | null
  slug: string
}

export const loadStateDeputyOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<StateDeputyRelationOption[]> => {
  const result = await payload.find({
    collection: 'stateDeputy',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, party: true, slug: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs.map((stateDeputy) => ({
    id: stateDeputy.id,
    name: stateDeputy.party ? `${stateDeputy.name} (${stateDeputy.party})` : stateDeputy.name,
    plainName: stateDeputy.name,
    party: stateDeputy.party ?? null,
    slug: stateDeputy.slug,
  }))
}

/**
 * Leadership catalog for typeahead cells (B36). Access of `canReadLeadership`
 * already scopes an advisor to leaderships of administered municipalities —
 * no manual intersection with `getAccessibleLeadershipIds`.
 */
export const loadLeadershipOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'leadership',
    depth: 1,
    limit: 0,
    pagination: false,
    select: { contact: true },
    where: {},
    user,
    overrideAccess: false,
  })
  return result.docs
    .map((leadership) => ({
      id: leadership.id,
      name: populatedContactName(leadership.contact),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}
