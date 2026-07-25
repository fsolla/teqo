import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import {
  effectivePledgeVotesForScenario,
  toVoteEstimateScenarioViewModel,
  VOTE_ESTIMATE_SCENARIOS,
} from '@/lib/voteEstimate'
import type { CampaignUser, VotePledge } from '@/payload-types'
import { latestIsoTimestamp } from '@/utilities/campaignTime'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import {
  createEmptyMunicipalityPledgeAggregate,
  pledgeHasAnyEstimate,
  type MunicipalityPledgeAggregate,
  type StaffPledgeRow,
} from '@/utilities/votePledgeViews'

/**
 * Pledge Payload READS. The pure aggregation math and view models live in
 * `votePledgeViews.ts` (client-safe contract module).
 */

/**
 * Staff-only aggregate over an already access-checked municipality id set.
 * Intentional admin bypass: callers pass municipality ids the actor may read.
 */
export const aggregatePledgesByMunicipality = async (
  payload: Pick<Payload, 'find'>,
  municipalityIDs: number[],
  req?: PayloadRequest,
): Promise<Map<number, MunicipalityPledgeAggregate>> => {
  const aggregates = new Map<number, MunicipalityPledgeAggregate>()
  if (municipalityIDs.length === 0) return aggregates

  const result = await payload.find({
    collection: 'votePledge',
    where: { municipality: { in: municipalityIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      municipality: true,
      declaredVotes: true,
      estimatedVotes: {
        pessimistic: true,
        central: true,
        optimistic: true,
      },
      // E9 freshness (`lastPledgeAt`) — the queue orders by how cold the signal is.
      declaredAt: true,
      estimatedAt: true,
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  for (const doc of result.docs) {
    // `select` narrows the runtime shape, not the static type Payload returns.
    const pledge = doc as VotePledge
    const municipalityID = relationshipId(pledge.municipality)
    if (municipalityID === null) continue
    const declared = pledge.declaredVotes ?? 0
    const estimated = pledge.estimatedVotes
    const current = aggregates.get(municipalityID) ?? createEmptyMunicipalityPledgeAggregate()
    current.declaredTotal += declared
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      current.effectiveByScenario[scenario] += effectivePledgeVotesForScenario(
        declared,
        estimated,
        scenario,
      )
    }
    current.pledgeCount += 1
    if (!pledgeHasAnyEstimate(estimated)) current.missingEstimateCount += 1
    current.lastPledgeAt = latestIsoTimestamp(
      current.lastPledgeAt,
      latestIsoTimestamp(pledge.declaredAt, pledge.estimatedAt),
    )
    aggregates.set(municipalityID, current)
  }

  return aggregates
}

/** Staff view of a municipality's pledges with leadership contact names. */
export const loadMunicipalityPledges = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<StaffPledgeRow[]> => {
  const pledges = await payload.find({
    collection: 'votePledge',
    where: { municipality: { equals: municipalityID } },
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
    estimatedVotes: toVoteEstimateScenarioViewModel(pledge.estimatedVotes),
    estimateNote: pledge.estimateNote ?? null,
    estimatedAt: pledge.estimatedAt ?? null,
  }))
}
