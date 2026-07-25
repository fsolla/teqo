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
  computeStatewideSuggestedGoals,
  type MunicipalityPotential,
  type SuggestedGoalByScenario,
} from '@/utilities/municipalityPotential'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  zeroByVoteEstimateScenario,
  type VoteEstimateScenarioFields,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import { emptyMunicipalityPledgeAggregate, type MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

type GoalAccountReader = CampaignUser | User

/**
 * E8 "conta da cadeira" — request-scoped statewide suggested-goal ladder
 * (`campaignGoals` global + `computeStatewideSuggestedGoals`), degrau 1 da
 * caching ladder. Every surface (dashboard, list overview, list rows, detail
 * card) needs the SAME goals — the optimistic scenario's growth factor is
 * `stateGoal / Σ base` over the full 435-slug catalog, so this always runs
 * over the whole catalog, never a filtered scope, and is
 * `cache()`-deduplicated so dashboard + list + detail don't each recompute it
 * on requests that touch more than one.
 */
const loadSuggestedGoalsCached = cache(
  async (payload: Payload, user: GoalAccountReader) => {
    const goals = await loadCampaignGoals(payload, user)
    return computeStatewideSuggestedGoals(goals)
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
  const { suggestedGoalBySlug } = await loadSuggestedGoalsCached(payload, user)

  const coverageByMunicipalityID = new Map<
    number,
    Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  >()
  for (const municipality of municipalities) {
    const pledgeAggregate =
      pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    const suggestedGoalByScenario =
      suggestedGoalBySlug.get(municipality.slug) ?? emptySuggestedGoalByScenario
    coverageByMunicipalityID.set(
      municipality.id,
      computeGoalCoverageByScenario(
        municipality.expectedVotes,
        suggestedGoalByScenario,
        pledgeAggregate,
      ),
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

/** Unknown slug (never in the catalog): zero goal in every scenario, never mutated. */
const emptySuggestedGoalByScenario: Readonly<SuggestedGoalByScenario> = zeroByVoteEstimateScenario()

export type MunicipalityGoalAccount = {
  /** Fixed to the `central` scenario, like `goalCoverage` below. */
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
  const { suggestedGoalBySlug, potentialBySlug } = await loadSuggestedGoalsCached(payload, user)
  const suggestedGoalByScenario =
    suggestedGoalBySlug.get(municipality.slug) ?? emptySuggestedGoalByScenario
  const goalCoverage = computeGoalCoverage(
    municipality.expectedVotes,
    suggestedGoalByScenario,
    pledgeAggregate,
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )
  const potential =
    potentialBySlug.get(municipality.slug) ?? computeMunicipalityPotential(municipality.slug)

  return {
    suggestedGoal: suggestedGoalByScenario[DEFAULT_VOTE_ESTIMATE_SCENARIO],
    goalCoverage,
    potential,
  }
}
