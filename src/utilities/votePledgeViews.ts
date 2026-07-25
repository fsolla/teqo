import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  effectivePledgeVotesForScenario,
  resolveMunicipalityStaffVoteTotalForScenario,
  VOTE_ESTIMATE_SCENARIOS,
  zeroByVoteEstimateScenario,
  type VoteEstimateScenario,
  type VoteEstimateScenarioFields,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'
import { latestIsoTimestamp } from '@/utilities/campaignTime'

/**
 * Pledge aggregation VIEWS — pure math and view models, client-safe (the
 * contract-module side of `votePledgeData.ts`, which owns the Payload reads
 * and is `server-only`). "Effective" votes on staff surfaces are
 * `estimated[S] ?? declaredVotes` per scenario; leader-facing surfaces must
 * NEVER receive estimated values or effective totals derived from them.
 */

export type MunicipalityPledgeAggregate = {
  declaredTotal: number
  effectiveByScenario: Record<VoteEstimateScenario, number>
  pledgeCount: number
  missingEstimateCount: number
  /**
   * Most recent `declaredAt`/`estimatedAt` across the município's pledges —
   * E9 freshness: a commitment nobody has touched in weeks is worth less
   * (`docs/research`, l. 339), so the allocation queue can order by how cold
   * the signal is. `null` when no pledge carries a date.
   */
  lastPledgeAt: string | null
}

export const createEmptyMunicipalityPledgeAggregate = (): MunicipalityPledgeAggregate => ({
  declaredTotal: 0,
  effectiveByScenario: zeroByVoteEstimateScenario(),
  pledgeCount: 0,
  missingEstimateCount: 0,
  lastPledgeAt: null,
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

export const pledgeHasAnyEstimate = (
  estimated: VoteEstimateScenarioFields | null | undefined,
): boolean =>
  estimated?.pessimistic != null || estimated?.central != null || estimated?.optimistic != null

export const aggregateMunicipalityPledgesFromRows = (
  rows: ReadonlyArray<{
    declaredVotes: number
    estimatedVotes?: VoteEstimateScenarioFields | null
    declaredAt?: string | null
    estimatedAt?: string | null
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
    aggregate.lastPledgeAt = latestIsoTimestamp(
      aggregate.lastPledgeAt,
      latestIsoTimestamp(row.declaredAt, row.estimatedAt),
    )
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
  const staffVoteTotalByScenario = zeroByVoteEstimateScenario()
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

/** Staff view row of a municipality pledge with the leadership contact name. */
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
