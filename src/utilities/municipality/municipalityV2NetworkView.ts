/**
 * Pure view helpers + row model for municipality v2 network (B149).
 */
import type { SupportStatus } from '@/lib/schemas/leadership'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  effectivePledgeVotesForScenario,
  toVoteEstimateScenarioViewModel,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

/** Same cap as the dossier leadership preview — dense, not exhaustive. */
export const MUNICIPALITY_V2_NETWORK_LIMIT = 8

export type MunicipalityV2NetworkRow = {
  leadershipID: number
  name: string
  supportStatus: SupportStatus | null
  pledgeID: number | null
  declaredVotes: number | null
  estimatedVotes: VoteEstimateScenarioViewModel
}

export type MunicipalityV2NetworkViewModel = {
  municipalityID: number
  slug: string
  rows: MunicipalityV2NetworkRow[]
  totalCount: number
}

/** Minimal leadership input for merge — keeps this module client-safe. */
export type MunicipalityV2NetworkLeadershipInput = {
  id: number
  name: string
  supportStatus: SupportStatus | null
}

/** Minimal pledge input for merge — keeps this module client-safe. */
export type MunicipalityV2NetworkPledgeInput = {
  id: number
  leadershipID: number
  declaredVotes: number
  estimatedVotes: VoteEstimateScenarioViewModel
}

const networkRowSortScore = (row: MunicipalityV2NetworkRow): number => {
  const declared = row.declaredVotes ?? 0
  return effectivePledgeVotesForScenario(
    declared,
    row.estimatedVotes,
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )
}

export const buildMunicipalityV2NetworkRows = (
  leaderships: MunicipalityV2NetworkLeadershipInput[],
  pledges: MunicipalityV2NetworkPledgeInput[],
  limit = MUNICIPALITY_V2_NETWORK_LIMIT,
): { rows: MunicipalityV2NetworkRow[]; totalCount: number } => {
  const pledgeByLeadership = new Map(pledges.map((pledge) => [pledge.leadershipID, pledge]))

  const merged: MunicipalityV2NetworkRow[] = leaderships.map((leadership) => {
    const pledge = pledgeByLeadership.get(leadership.id)
    return {
      leadershipID: leadership.id,
      name: leadership.name,
      supportStatus: leadership.supportStatus,
      pledgeID: pledge?.id ?? null,
      declaredVotes: pledge?.declaredVotes ?? null,
      estimatedVotes: pledge?.estimatedVotes ?? toVoteEstimateScenarioViewModel(null),
    }
  })

  const sorted = [...merged].sort((left, right) => {
    const scoreDelta = networkRowSortScore(right) - networkRowSortScore(left)
    if (scoreDelta !== 0) return scoreDelta
    const declaredDelta = (right.declaredVotes ?? 0) - (left.declaredVotes ?? 0)
    if (declaredDelta !== 0) return declaredDelta
    return left.name.localeCompare(right.name, 'pt-BR')
  })

  return {
    rows: sorted.slice(0, limit),
    totalCount: leaderships.length,
  }
}
