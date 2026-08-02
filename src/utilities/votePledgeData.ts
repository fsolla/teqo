import 'server-only'

import type { Payload, PayloadRequest, Where } from 'payload'

import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignUser, VotePledge } from '@/payload-types'
import { loadLeadershipContactNamesByIds } from '@/utilities/loadNamesByIds'
import {
  aggregateMunicipalityPledgesFromRows,
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
  if (municipalityIDs.length === 0) return new Map()

  return aggregatePledgesWhere(payload, { municipality: { in: municipalityIDs } }, req)
}

/**
 * The same aggregate over EVERY pledge, for a caller whose município scope is
 * the whole catalog: there `municipality IN (…)` excludes nothing, so dropping
 * it lets the pledge read leave in the same round trip as the município read
 * instead of waiting for its ids (and drops a 435-element IN list). Keys the
 * caller doesn't know are harmless — every consumer looks the map up by
 * município id, none iterates it.
 */
export const aggregateAllPledgesByMunicipality = (
  payload: Pick<Payload, 'find'>,
  req?: PayloadRequest,
): Promise<Map<number, MunicipalityPledgeAggregate>> => aggregatePledgesWhere(payload, {}, req)

const aggregatePledgesWhere = async (
  payload: Pick<Payload, 'find'>,
  where: Where,
  req?: PayloadRequest,
): Promise<Map<number, MunicipalityPledgeAggregate>> => {
  const result = await payload.find({
    collection: 'votePledge',
    where,
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
    // Intentional admin bypass: the `where` argument is already scope-narrowed
    // by the exported wrappers above; the aggregate must not re-filter silently.
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  // Group rows by município, then fold each bucket with the ONE pledge-aggregate
  // fold (`aggregateMunicipalityPledgesFromRows`) — the list and the dossiê
  // cannot drift because there is only one implementation (P3-E pin).
  const rowsByMunicipality = new Map<
    number,
    Array<{
      declaredVotes: number
      estimatedVotes: VotePledge['estimatedVotes']
      declaredAt?: string | null
      estimatedAt?: string | null
    }>
  >()
  for (const doc of result.docs) {
    // `select` narrows the runtime shape, not the static type Payload returns.
    const pledge = doc as VotePledge
    const municipalityID = relationshipId(pledge.municipality)
    if (municipalityID === null) continue
    const rows = rowsByMunicipality.get(municipalityID) ?? []
    rows.push({
      declaredVotes: pledge.declaredVotes ?? 0,
      estimatedVotes: pledge.estimatedVotes,
      declaredAt: pledge.declaredAt,
      estimatedAt: pledge.estimatedAt,
    })
    rowsByMunicipality.set(municipalityID, rows)
  }

  const aggregates = new Map<number, MunicipalityPledgeAggregate>()
  for (const [municipalityID, rows] of rowsByMunicipality) {
    aggregates.set(municipalityID, aggregateMunicipalityPledgesFromRows(rows))
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
  const nameByLeadership = await loadLeadershipContactNamesByIds(payload, leadershipIDs)

  return pledges.docs.map((pledge) => ({
    id: pledge.id,
    leadershipID: requireRelationshipId(pledge.leadership),
    contactName: nameByLeadership.get(requireRelationshipId(pledge.leadership)) ?? 'Contato',
    declaredVotes: pledge.declaredVotes,
    declaredAt: pledge.declaredAt ?? null,
    estimatedVotes: toVoteEstimateScenarioViewModel(pledge.estimatedVotes),
    estimateNote: pledge.estimateNote ?? null,
    estimatedAt: pledge.estimatedAt ?? null,
    updatedAt: pledge.updatedAt,
  }))
}
