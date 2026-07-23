import type { Payload, PayloadRequest } from 'payload'

import type { CampaignUser, VotePledge } from '@/payload-types'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  effectivePledgeVotesForScenario,
  resolvePlazaStaffVoteTotalForScenario,
  toVoteEstimateScenarioViewModel,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
  type VoteEstimateScenarioFields,
  type VoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

/**
 * Pledge aggregation helpers. "Effective" votes on staff surfaces are
 * `estimated[S] ?? declaredVotes` per scenario; leader-facing surfaces must
 * NEVER receive estimated values or effective totals derived from them.
 */

export type { VoteEstimateScenario, VoteEstimateScenarioViewModel }

const emptyEffectiveByScenario = (): Record<VoteEstimateScenario, number> => ({
  pessimistic: 0,
  central: 0,
  optimistic: 0,
})

export type PlazaPledgeAggregate = {
  declaredTotal: number
  effectiveByScenario: Record<VoteEstimateScenario, number>
  pledgeCount: number
  missingEstimateCount: number
}

export const createEmptyPlazaPledgeAggregate = (): PlazaPledgeAggregate => ({
  declaredTotal: 0,
  effectiveByScenario: emptyEffectiveByScenario(),
  pledgeCount: 0,
  missingEstimateCount: 0,
})

/** Read-only zero aggregate. Never mutate — use createEmptyPlazaPledgeAggregate() when writing. */
export const emptyPlazaPledgeAggregate: Readonly<PlazaPledgeAggregate> =
  createEmptyPlazaPledgeAggregate()

export type PlazaPledgeCoverageView = {
  pledgeCount: number
  missingEstimateCount: number
  declaredTotal: number
  effectiveTotal: number
}

export const toPlazaPledgeCoverageView = (
  aggregate: PlazaPledgeAggregate,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): PlazaPledgeCoverageView | null => {
  if (aggregate.pledgeCount === 0) return null
  return {
    pledgeCount: aggregate.pledgeCount,
    missingEstimateCount: aggregate.missingEstimateCount,
    declaredTotal: aggregate.declaredTotal,
    effectiveTotal: aggregate.effectiveByScenario[scenario],
  }
}

/** Staff-facing plaza total: manual expected votes override pledge aggregate when set. */
export const resolvePlazaStaffVoteTotal = (
  expectedVotes: VoteEstimateScenarioFields | null | undefined,
  pledgeEffectiveTotal: number,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): number => resolvePlazaStaffVoteTotalForScenario(expectedVotes, pledgeEffectiveTotal, scenario)

export const aggregatePlazaPledgesFromRows = (
  rows: ReadonlyArray<{
    declaredVotes: number
    estimatedVotes?: VoteEstimateScenarioFields | null
  }>,
): PlazaPledgeAggregate => {
  const aggregate = createEmptyPlazaPledgeAggregate()

  for (const row of rows) {
    const declared = row.declaredVotes ?? 0
    aggregate.declaredTotal += declared
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      aggregate.effectiveByScenario[scenario] += effectivePledgeVotesForScenario(
        declared,
        row.estimatedVotes,
        scenario,
      )
    }
    aggregate.pledgeCount += 1
    if (!pledgeHasAnyEstimate(row.estimatedVotes)) aggregate.missingEstimateCount += 1
  }

  return aggregate
}

export type PlazaStaffVoteRollup = {
  staffVoteTotal: number
  staffVoteTotalByScenario: Record<VoteEstimateScenario, number>
  declaredVotesTotal: number
  pledgeCount: number
  missingEstimateCount: number
}

export const rollupPlazaStaffVotes = (
  plazas: ReadonlyArray<{ id: number; expectedVotes?: VoteEstimateScenarioFields | null }>,
  pledgeAggregates: Map<number, PlazaPledgeAggregate>,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): PlazaStaffVoteRollup => {
  let staffVoteTotal = 0
  const staffVoteTotalByScenario = emptyEffectiveByScenario()
  let declaredVotesTotal = 0
  let pledgeCount = 0
  let missingEstimateCount = 0
  for (const plaza of plazas) {
    const aggregate = pledgeAggregates.get(plaza.id) ?? emptyPlazaPledgeAggregate
    for (const key of VOTE_ESTIMATE_SCENARIOS) {
      staffVoteTotalByScenario[key] += resolvePlazaStaffVoteTotal(
        plaza.expectedVotes,
        aggregate.effectiveByScenario[key],
        key,
      )
    }
    staffVoteTotal += resolvePlazaStaffVoteTotal(
      plaza.expectedVotes,
      aggregate.effectiveByScenario[scenario],
      scenario,
    )
    declaredVotesTotal += aggregate.declaredTotal
    pledgeCount += aggregate.pledgeCount
    missingEstimateCount += aggregate.missingEstimateCount
  }
  return {
    staffVoteTotal,
    staffVoteTotalByScenario,
    declaredVotesTotal,
    pledgeCount,
    missingEstimateCount,
  }
}

const pledgeHasAnyEstimate = (estimated: VoteEstimateScenarioFields | null | undefined): boolean =>
  estimated?.pessimistic != null || estimated?.central != null || estimated?.optimistic != null

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
    select: {
      plaza: true,
      declaredVotes: true,
      estimatedVotes: {
        pessimistic: true,
        central: true,
        optimistic: true,
      },
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  for (const doc of result.docs) {
    const plazaID = relationshipId((doc as VotePledge).plaza)
    if (plazaID === null) continue
    const declared = (doc as VotePledge).declaredVotes ?? 0
    const estimated = (doc as VotePledge).estimatedVotes
    const current = aggregates.get(plazaID) ?? createEmptyPlazaPledgeAggregate()
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
  estimatedVotes: VoteEstimateScenarioViewModel
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
    where: {},
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'plaza',
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
