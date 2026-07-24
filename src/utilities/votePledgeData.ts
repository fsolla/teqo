import type { Payload, PayloadRequest } from 'payload'

import type { CampaignUser, VotePledge } from '@/payload-types'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  effectivePledgeVotesForScenario,
  resolveMunicipalityStaffVoteTotalForScenario,
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

export type MunicipalityPledgeAggregate = {
  declaredTotal: number
  effectiveByScenario: Record<VoteEstimateScenario, number>
  pledgeCount: number
  missingEstimateCount: number
}

export const createEmptyMunicipalityPledgeAggregate = (): MunicipalityPledgeAggregate => ({
  declaredTotal: 0,
  effectiveByScenario: emptyEffectiveByScenario(),
  pledgeCount: 0,
  missingEstimateCount: 0,
})

/** Read-only zero aggregate. Never mutate — use createEmptyMunicipalityPledgeAggregate() when writing. */
export const emptyMunicipalityPledgeAggregate: Readonly<MunicipalityPledgeAggregate> =
  createEmptyMunicipalityPledgeAggregate()

export type MunicipalityPledgeCoverageView = {
  pledgeCount: number
  missingEstimateCount: number
  declaredTotal: number
  effectiveTotal: number
}

export const toMunicipalityPledgeCoverageView = (
  aggregate: MunicipalityPledgeAggregate,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): MunicipalityPledgeCoverageView | null => {
  if (aggregate.pledgeCount === 0) return null
  return {
    pledgeCount: aggregate.pledgeCount,
    missingEstimateCount: aggregate.missingEstimateCount,
    declaredTotal: aggregate.declaredTotal,
    effectiveTotal: aggregate.effectiveByScenario[scenario],
  }
}

/** Staff-facing municipality total: manual expected votes override pledge aggregate when set. */
export const resolveMunicipalityStaffVoteTotal = (
  expectedVotes: VoteEstimateScenarioFields | null | undefined,
  pledgeEffectiveTotal: number,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): number =>
  resolveMunicipalityStaffVoteTotalForScenario(expectedVotes, pledgeEffectiveTotal, scenario)

export const aggregateMunicipalityPledgesFromRows = (
  rows: ReadonlyArray<{
    declaredVotes: number
    estimatedVotes?: VoteEstimateScenarioFields | null
  }>,
): MunicipalityPledgeAggregate => {
  const aggregate = createEmptyMunicipalityPledgeAggregate()

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

export type MunicipalityStaffVoteRollup = {
  staffVoteTotal: number
  staffVoteTotalByScenario: Record<VoteEstimateScenario, number>
  declaredVotesTotal: number
  pledgeCount: number
  missingEstimateCount: number
}

export const rollupMunicipalityStaffVotes = (
  municipalities: ReadonlyArray<{ id: number; expectedVotes?: VoteEstimateScenarioFields | null }>,
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): MunicipalityStaffVoteRollup => {
  let staffVoteTotal = 0
  const staffVoteTotalByScenario = emptyEffectiveByScenario()
  let declaredVotesTotal = 0
  let pledgeCount = 0
  let missingEstimateCount = 0
  for (const municipality of municipalities) {
    const aggregate = pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    for (const key of VOTE_ESTIMATE_SCENARIOS) {
      staffVoteTotalByScenario[key] += resolveMunicipalityStaffVoteTotal(
        municipality.expectedVotes,
        aggregate.effectiveByScenario[key],
        key,
      )
    }
    staffVoteTotal += resolveMunicipalityStaffVoteTotal(
      municipality.expectedVotes,
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
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  for (const doc of result.docs) {
    const municipalityID = relationshipId((doc as VotePledge).municipality)
    if (municipalityID === null) continue
    const declared = (doc as VotePledge).declaredVotes ?? 0
    const estimated = (doc as VotePledge).estimatedVotes
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
    aggregates.set(municipalityID, current)
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
