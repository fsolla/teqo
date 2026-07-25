import { formatElectionNumber } from '@/lib/electionFormat'
import {
  getVoteEstimateForScenario,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
  type VoteEstimateScenarioFields,
} from '@/lib/voteEstimate'
import type { SuggestedGoalByScenario } from '@/utilities/municipalityPotential'
import type { MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

/**
 * E8 "conta da cadeira" — coverage of the goal by auditable pledges.
 *
 * Semantics locked this session (see the E8 plan's audit finding #2):
 * - **meta** = `expectedVotes[cenário] ?? suggestedGoal[cenário]` — the mesa's
 *   own expectation when set (`Municipality.expectedVotes`), falling back to
 *   the suggested goal for the SAME scenario (`municipalityPotential.ts`'s
 *   `deriveSuggestedGoalsByScenario`, anchored on the candidate's own 2022
 *   vote). Both sides of the fallback are now per-scenario, so switching the
 *   list's scenario picker moves the goal as well as the commitment.
 * - **comprometido** = `aggregate.effectiveByScenario[cenário]` — the pledge
 *   aggregate ONLY (`estimated[S] ?? declared`, summed over `votePledge`
 *   rows). It is deliberately **not** `resolveMunicipalityStaffVoteTotal`,
 *   which lets `expectedVotes` override the pledge sum — using that here
 *   would report 100% coverage everywhere the projection-sheet import (E4R)
 *   set an expectation without a single pledge behind it.
 *
 * Coverage answers "how much of what the mesa expects is backed by an
 * auditable commitment", not "did the mesa fill in a number".
 */
export type MunicipalityGoalCoverage = {
  goal: number
  committed: number
  /** committed / goal, or null when goal is zero/negative (avoids a misleading Infinity/NaN). */
  coverageRatio: number | null
  /** goal − committed; negative means the municipality is over-committed relative to its goal. */
  deficit: number
}

/** E9 list + B20 dashboard: rank key for `central` when goal > 0; null sorts last. */
export const centralDeficitSortValue = (
  coverage: MunicipalityGoalCoverage | null | undefined,
): number | null => (coverage && coverage.goal > 0 ? coverage.deficit : null)

/** Read-only zero coverage — never mutate; use for view models outside the staff scope. */
const emptyMunicipalityGoalCoverage: Readonly<MunicipalityGoalCoverage> = {
  goal: 0,
  committed: 0,
  coverageRatio: null,
  deficit: 0,
}

/** All three scenarios pointing at the same zero coverage (never mutate). */
export const createEmptyGoalCoverageByScenario = (): Record<
  VoteEstimateScenario,
  MunicipalityGoalCoverage
> => {
  const byScenario = {} as Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  for (const scenario of VOTE_ESTIMATE_SCENARIOS)
    byScenario[scenario] = emptyMunicipalityGoalCoverage
  return byScenario
}

/** Coverage for one municipality, one scenario. */
export const computeGoalCoverage = (
  expectedVotes: VoteEstimateScenarioFields | null | undefined,
  suggestedGoalByScenario: SuggestedGoalByScenario,
  pledgeAggregate: MunicipalityPledgeAggregate,
  scenario: VoteEstimateScenario,
): MunicipalityGoalCoverage => {
  const goal =
    getVoteEstimateForScenario(expectedVotes, scenario) ?? suggestedGoalByScenario[scenario]
  const committed = pledgeAggregate.effectiveByScenario[scenario]
  const coverageRatio = goal > 0 ? committed / goal : null
  const deficit = goal - committed
  return { goal, committed, coverageRatio, deficit }
}

/** Coverage for one municipality, all three scenarios (mirrors `staffVoteTotalByScenario`). */
export const computeGoalCoverageByScenario = (
  expectedVotes: VoteEstimateScenarioFields | null | undefined,
  suggestedGoalByScenario: SuggestedGoalByScenario,
  pledgeAggregate: MunicipalityPledgeAggregate,
): Record<VoteEstimateScenario, MunicipalityGoalCoverage> => {
  const coverageByScenario = {} as Record<VoteEstimateScenario, MunicipalityGoalCoverage>
  for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
    coverageByScenario[scenario] = computeGoalCoverage(
      expectedVotes,
      suggestedGoalByScenario,
      pledgeAggregate,
      scenario,
    )
  }
  return coverageByScenario
}

/** Sums a list of per-municipality coverages into one aggregate (dashboard/overview total). */
export const aggregateGoalCoverage = (
  entries: ReadonlyArray<MunicipalityGoalCoverage>,
): MunicipalityGoalCoverage => {
  const goal = entries.reduce((sum, entry) => sum + entry.goal, 0)
  const committed = entries.reduce((sum, entry) => sum + entry.committed, 0)
  const coverageRatio = goal > 0 ? committed / goal : null
  const deficit = goal - committed
  return { goal, committed, coverageRatio, deficit }
}

/**
 * Generic ratio→percent label, e.g. for `MunicipalityPotential`'s
 * `captureRate2022`/`intraFieldShareByYear` diagnostics on the goal-account
 * card — shared here so those and `coverageRatio` don't each round/format
 * independently.
 */
export const formatRatioAsPercentLabel = (ratio: number | null): string =>
  ratio == null ? '—' : `${Math.round(ratio * 100)}%`

/** `coverageRatio` as a rounded percent string, or "—" when the goal is zero/unknown. */
export const formatGoalCoverageRatioLabel = (coverage: MunicipalityGoalCoverage): string =>
  formatRatioAsPercentLabel(coverage.coverageRatio)

/** `coverageRatio` clamped to [0, 100] for a `Progress` bar, or `undefined` when unknown. */
export const goalCoverageProgressPercent = (
  coverage: MunicipalityGoalCoverage,
): number | undefined =>
  coverage.coverageRatio == null
    ? undefined
    : Math.min(100, Math.round(coverage.coverageRatio * 100))

/** UI copy for `deficit`: how many votes are missing (or exceeded) relative to the goal. */
export const formatGoalCoverageDeficitLabel = (coverage: MunicipalityGoalCoverage): string => {
  if (coverage.goal <= 0) return 'Sem meta definida'
  if (coverage.deficit > 0) {
    return `Faltam ${formatElectionNumber(coverage.deficit)} votos para a meta`
  }
  if (coverage.deficit < 0) {
    return `${formatElectionNumber(Math.abs(coverage.deficit))} acima da meta`
  }
  return 'Meta coberta'
}

/**
 * `-1.234`/`+300`-style short form of `deficit` for dense table cells — pair
 * with `formatGoalCoverageDeficitLabel` as a `title` tooltip (same pattern as
 * `StaffMunicipalityVotesDisplay`'s "Nas lideranças" subline).
 */
export const formatGoalCoverageDeficitShortLabel = (coverage: MunicipalityGoalCoverage): string => {
  if (coverage.goal <= 0) return '—'
  if (coverage.deficit === 0) return '0'
  const sign = coverage.deficit > 0 ? '−' : '+'
  return `${sign}${formatElectionNumber(Math.abs(coverage.deficit))}`
}
