import 'server-only'

import { cache } from 'react'

import type { Payload } from 'payload'

import type { CampaignUser, User } from '@/payload-types'
import { loadCampaignGoals } from '@/utilities/campaignGoals'
import {
  aggregateGoalCoverage,
  computeGoalCoverage,
  computeGoalCoverageByScenario,
  type MunicipalityGoalCoverage,
} from '@/utilities/goalCoverage'
import {
  computeMunicipalityPotential,
  computeStatewideGoalDecomposition,
  type MunicipalityPotential,
} from '@/utilities/municipalityPotential'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenarioFields,
  type VoteEstimateScenario,
} from '@/utilities/voteEstimate'
import {
  emptyMunicipalityPledgeAggregate,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeData'

type GoalAccountReader = CampaignUser | User

/**
 * E8 "conta da cadeira" — request-scoped statewide goal decomposition
 * (`campaignGoals` global + `computeStatewideGoalDecomposition`), degrau 1 da
 * caching ladder. Every surface (dashboard, list overview, list rows,
 * detail card) needs the SAME decomposition — `suggestedGoal` for one
 * município is only meaningful relative to the full 435-slug ceiling total,
 * so this always runs over the whole catalog, never a filtered scope, and is
 * `cache()`-deduplicated so dashboard + list + detail don't each recompute it
 * on requests that touch more than one.
 */
const loadGoalDecompositionCached = cache(
  async (payload: Payload, user: GoalAccountReader) => {
    const goals = await loadCampaignGoals(payload, user)
    return computeStatewideGoalDecomposition(goals)
  },
)

export type MunicipalityGoalCoverageBundle = {
  coverageByMunicipalityID: Map<number, Record<VoteEstimateScenario, MunicipalityGoalCoverage>>
  /** Sum of every municipality's coverage in `municipalities`, per scenario (dashboard/overview metric). */
  aggregateByScenario: Record<VoteEstimateScenario, MunicipalityGoalCoverage>
}

/**
 * Per-scenario goal coverage for a scope of municipalities (dashboard total,
 * or the list's filtered overview) plus the per-municipality breakdown the
 * list rows pick a scenario from client-side — mirrors
 * `rollupMunicipalityStaffVotes`'s "compute all 3 scenarios server-side, pick
 * client-side" shape.
 */
export const loadMunicipalityGoalCoverageBundle = async (
  payload: Payload,
  user: GoalAccountReader,
  municipalities: ReadonlyArray<{
    id: number
    slug: string
    expectedVotes?: VoteEstimateScenarioFields | null
  }>,
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>,
): Promise<MunicipalityGoalCoverageBundle> => {
  const { suggestedGoalBySlug } = await loadGoalDecompositionCached(payload, user)

  const coverageByMunicipalityID = new Map<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >()
  for (const municipality of municipalities) {
    const pledgeAggregate =
      pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    const suggestedGoal = suggestedGoalBySlug.get(municipality.slug) ?? 0
    coverageByMunicipalityID.set(
      municipality.id,
      computeGoalCoverageByScenario(municipality.expectedVotes, suggestedGoal, pledgeAggregate),
    )
  }

  const coverages = [...coverageByMunicipalityID.values()]
  const aggregateByScenario = {} as Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
    aggregateByScenario[scenario] = aggregateGoalCoverage(
      coverages.map((coverageByScenario) => coverageByScenario[scenario]),
    )
  }

  return { coverageByMunicipalityID, aggregateByScenario }
}

export type MunicipalityGoalAccount = {
  suggestedGoal: number
  /** Fixed to the `central` scenario — the detail page has no scenario selector. */
  goalCoverage: MunicipalityGoalCoverage
  potential: MunicipalityPotential
}

/**
 * One município's full "conta da cadeira": suggested goal, coverage (central
 * scenario), and the diagnostic potential block (teto do campo, captura,
 * share intracampo, roll-off) — the detail page's "Conta da cadeira" card.
 */
export const loadMunicipalityGoalAccount = async (
  payload: Payload,
  user: GoalAccountReader,
  municipality: { slug: string; expectedVotes?: VoteEstimateScenarioFields | null },
  pledgeAggregate: MunicipalityPledgeAggregate,
): Promise<MunicipalityGoalAccount> => {
  const { suggestedGoalBySlug, potentialBySlug } = await loadGoalDecompositionCached(payload, user)
  const suggestedGoal = suggestedGoalBySlug.get(municipality.slug) ?? 0
  const goalCoverage = computeGoalCoverage(
    municipality.expectedVotes,
    suggestedGoal,
    pledgeAggregate,
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )
  const potential =
    potentialBySlug.get(municipality.slug) ?? computeMunicipalityPotential(municipality.slug)

  return { suggestedGoal, goalCoverage, potential }
}
