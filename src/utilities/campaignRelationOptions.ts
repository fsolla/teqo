import 'server-only'

import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { populatedContactName } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'
import { eligibleCampaignStaffWhere } from '@/utilities/campaignAccess'

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

export type CampaignUserSummary = {
  id: number
  name: string
}

/**
 * Names for a set of assigned advisor ids (B156) — the same catalog read the
 * municipios list does with `loadAdvisorSummaries`, but without the phone and
 * in the shared relation-options module (the dobradinhas cells need id+name
 * only). Honours `canReadCampaignUsers` and the eligibility filter, so a
 * stale id that fell out of staff is dropped — same fail-closed contract as
 * `loadAdvisorSummaries`.
 */
export const loadCampaignUserSummaries = async (
  payload: Payload,
  user: CampaignUser,
  ids: number[],
): Promise<CampaignUserSummary[]> => {
  if (ids.length === 0) return []

  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [{ id: { in: ids } }, eligibleCampaignStaffWhere],
    },
    depth: 0,
    pagination: false,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  const byId = new Map(result.docs.map((doc) => [doc.id, { id: doc.id, name: doc.name }]))

  return ids.flatMap((id) => {
    const summary = byId.get(id)
    return summary ? [summary] : []
  })
}

/**
 * The addable staff catalog for an advisor-relation cell (B156): every
 * eligible account (coordinator/advisor/candidate), sorted by name. The cell
 * resolves optimistic adds through it, same role as `getEligibleAdvisorOptions`
 * on the municipios list.
 */
export const loadEligibleAdvisorOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<RelationOption[]> => {
  const result = await payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    sort: 'name',
    where: eligibleCampaignStaffWhere,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  return result.docs.map(({ id, name }) => ({ id, name }))
}
