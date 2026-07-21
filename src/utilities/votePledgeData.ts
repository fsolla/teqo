import type { Payload, PayloadRequest } from 'payload'

import type { CampaignUser, VotePledge } from '@/payload-types'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'

/**
 * Pledge aggregation helpers. "Effective" votes on staff surfaces are
 * `estimatedVotes ?? declaredVotes`; leader-facing surfaces must NEVER receive
 * estimated values or effective totals derived from them.
 */

export type PlazaPledgeAggregate = {
  declaredTotal: number
  effectiveTotal: number
  pledgeCount: number
  missingEstimateCount: number
}

export const emptyPlazaPledgeAggregate: PlazaPledgeAggregate = {
  declaredTotal: 0,
  effectiveTotal: 0,
  pledgeCount: 0,
  missingEstimateCount: 0,
}

/**
 * Staff-only aggregate over an already access-checked plaza id set.
 * Intentional admin bypass: callers pass plaza ids the actor may read.
 */
export const aggregatePledgesByPlaza = async (
  payload: Pick<Payload, 'find'>,
  plazaIDs: number[],
  req?: PayloadRequest,
): Promise<Map<number, PlazaPledgeAggregate>> => {
  const aggregates = new Map<number, PlazaPledgeAggregate>()
  if (plazaIDs.length === 0) return aggregates

  const result = await payload.find({
    collection: 'votePledge',
    where: { plaza: { in: plazaIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { plaza: true, declaredVotes: true, estimatedVotes: true },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  for (const doc of result.docs) {
    const plazaID = relationshipId((doc as VotePledge).plaza)
    if (plazaID === null) continue
    const declared = (doc as VotePledge).declaredVotes ?? 0
    const estimated = (doc as VotePledge).estimatedVotes ?? null
    const current = aggregates.get(plazaID) ?? { ...emptyPlazaPledgeAggregate }
    current.declaredTotal += declared
    current.effectiveTotal += estimated ?? declared
    current.pledgeCount += 1
    if (estimated === null) current.missingEstimateCount += 1
    aggregates.set(plazaID, current)
  }

  return aggregates
}

export type StaffPledgeRow = {
  id: number
  leadershipID: number
  contactName: string
  declaredVotes: number
  declaredAt: string | null
  estimatedVotes: number | null
  estimateNote: string | null
  estimatedAt: string | null
}

/** Staff view of a plaza's pledges with leadership contact names. */
export const loadPlazaPledges = async (
  payload: Payload,
  user: CampaignUser,
  plazaID: number,
): Promise<StaffPledgeRow[]> => {
  const pledges = await payload.find({
    collection: 'votePledge',
    where: { plaza: { equals: plazaID } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-declaredVotes',
    user,
    overrideAccess: false,
  })
  if (pledges.docs.length === 0) return []

  const leadershipIDs = [
    ...new Set(pledges.docs.map((pledge) => requireRelationshipId(pledge.leadership))),
  ]
  // Intentional admin bypass: row access was already applied to the pledges;
  // this resolves display names without N+1 field-access checks.
  const leaderships = await payload.find({
    collection: 'leadership',
    where: { id: { in: leadershipIDs } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: { contact: true },
    overrideAccess: true,
  })
  const nameByLeadership = new Map<number, string>()
  for (const leadership of leaderships.docs) {
    const contact = leadership.contact
    const name =
      typeof contact === 'object' && contact !== null && 'name' in contact
        ? (contact.name as string)
        : 'Contato'
    nameByLeadership.set(leadership.id, name)
  }

  return pledges.docs.map((pledge) => ({
    id: pledge.id,
    leadershipID: requireRelationshipId(pledge.leadership),
    contactName: nameByLeadership.get(requireRelationshipId(pledge.leadership)) ?? 'Contato',
    declaredVotes: pledge.declaredVotes,
    declaredAt: pledge.declaredAt ?? null,
    estimatedVotes: pledge.estimatedVotes ?? null,
    estimateNote: pledge.estimateNote ?? null,
    estimatedAt: pledge.estimatedAt ?? null,
  }))
}

export type LeaderPledgeRow = {
  id: number
  plazaID: number
  plazaName: string
  plazaSlug: string
  declaredVotes: number
  declaredAt: string | null
}

/**
 * Leader view of their own pledges — declared values only. Estimated fields
 * are stripped by field access (overrideAccess: false) and deliberately never
 * mapped here.
 */
export const loadLeaderPledges = async (
  payload: Payload,
  user: CampaignUser,
): Promise<LeaderPledgeRow[]> => {
  const pledges = await payload.find({
    collection: 'votePledge',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'plaza',
    where: {},
    user,
    overrideAccess: false,
  })
  if (pledges.docs.length === 0) return []

  const plazaIDs = [...new Set(pledges.docs.map((pledge) => requireRelationshipId(pledge.plaza)))]
  const plazas = await payload.find({
    collection: 'plaza',
    where: { id: { in: plazaIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true, slug: true },
    overrideAccess: true,
  })
  const plazaById = new Map(plazas.docs.map((plaza) => [plaza.id, plaza]))

  return pledges.docs.map((pledge) => {
    const plazaID = requireRelationshipId(pledge.plaza)
    const plaza = plazaById.get(plazaID)
    return {
      id: pledge.id,
      plazaID,
      plazaName: plaza?.name ?? 'Praça',
      plazaSlug: plaza?.slug ?? '',
      declaredVotes: pledge.declaredVotes,
      declaredAt: pledge.declaredAt ?? null,
    }
  })
}
