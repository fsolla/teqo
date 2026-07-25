import {
  getMunicipalityFederalBaseline,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import {
  ELECTION_YEAR_2014,
  ELECTION_YEAR_2018,
  ELECTION_YEAR_2022,
  HISTORICAL_SERIES_YEARS,
} from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { CampaignGoal } from '@/payload-types'
import type { VoteEstimateScenario } from '@/utilities/voteEstimate'

/**
 * E8 "conta da cadeira" — derived electoral potential per municipality, built
 * entirely from the committed `bahia-federal-baseline.json` artifact (no DB
 * reads: pure functions over `getMunicipalityFederalBaseline`). Every
 * projection here is a documented, fixed formula — never a fitted model (see
 * the E8 plan's "rabbit holes vigiados": projection turning into a model).
 */

/** Own nominal votes in one year — 0 for a year the artifact doesn't cover. */
const votesInYear = (baseline: MunicipalityFederalBaseline, year: number): number =>
  baseline.votesByYear[String(year)] ?? 0

/**
 * Projected 2026 valid votes: weighted average of 2014/2018/2022 federal T1
 * valid votes, weighting 2022 double (closer election, more predictive of
 * turnout composition). Documented as a fixed formula, not a forecast:
 * `(v2014 + v2018 + 2×v2022) / 4`.
 */
export const projectedValidVotes = (baseline: MunicipalityFederalBaseline): number => {
  const v2014 = baseline.validVotesByYear[String(ELECTION_YEAR_2014)] ?? 0
  const v2018 = baseline.validVotesByYear[String(ELECTION_YEAR_2018)] ?? 0
  const v2022 = baseline.validVotesByYear[String(ELECTION_YEAR_2022)] ?? 0
  return (v2014 + v2018 + 2 * v2022) / 4
}

/**
 * "Teto do campo" (field ceiling): 2022 T1 votes for the presidential
 * candidate of the field (#13) — a majoritarian race attracts far more of
 * the field's total vote than the fragmented federal-deputy quotient race,
 * so it stands in for "how many votes could the field plausibly get here".
 * Primary reading only (governador is a secondary cross-check surfaced by the
 * artifact, not blended in — assumption flagged for product validation in
 * the E8 plan). 2022-only by design — see `bahiaElectionAggregates.ts` for
 * why the committed artifact doesn't cut 2014/2018 majoritária too.
 */
export const fieldCeiling = (baseline: MunicipalityFederalBaseline): number =>
  baseline.majoritarian2022?.president.votes ?? 0

/**
 * `fieldCeiling` scaled by the same turnout-growth factor used for
 * `projectedValidVotes` (projected ÷ observed 2022 valid votes), since the
 * ceiling itself has only one observed data point (2022). Falls back to the
 * unscaled ceiling when 2022 valid votes are unknown (avoids a divide-by-zero
 * blow-up rather than silently zeroing the projection).
 */
export const projectedFieldCeiling = (baseline: MunicipalityFederalBaseline): number => {
  const ceiling2022 = fieldCeiling(baseline)
  const validVotes2022 = baseline.validVotesByYear[String(ELECTION_YEAR_2022)] ?? 0
  if (validVotes2022 <= 0) return ceiling2022
  return ceiling2022 * (projectedValidVotes(baseline) / validVotes2022)
}

/**
 * Capture rate (diagnostic only, not a decomposition input): share of the
 * 2022 field ceiling that Solla's own candidacy actually captured. `null`
 * when the ceiling is unknown/zero rather than a misleading 0.
 */
export const captureRate = (baseline: MunicipalityFederalBaseline): number | null => {
  const ceiling = fieldCeiling(baseline)
  if (ceiling <= 0) return null
  return votesInYear(baseline, ELECTION_YEAR_2022) / ceiling
}

/**
 * Intra-field share (diagnostic only): of the curated field's federal-deputy
 * nominal votes (`campoFederalVotesByYear`, `campoParties.ts`) in a given
 * year, what share went to Solla specifically. Available for all three
 * historical years (unlike `fieldCeiling`, which is majoritarian and
 * 2022-only). `null` when the field polled zero that year.
 */
export const intraFieldShare = (baseline: MunicipalityFederalBaseline, year: number): number | null => {
  const campo = baseline.campoFederalVotesByYear[String(year)] ?? 0
  if (campo <= 0) return null
  return votesInYear(baseline, year) / campo
}

export type RollOff = {
  /** (brancos+nulos DF) − (brancos+nulos majoritária), in votes. */
  votes: number
  /** `votes` as a share of the federal-deputy T1 turnout, or null if turnout is unknown. */
  percentOfTurnout: number | null
}

/**
 * Roll-off (diagnostic only): the DF race always shows more blank/null votes
 * than the majoritarian race in the same turnout — this is the gap, in votes
 * and as a share of comparecimento. 2022-only, same artifact limitation as
 * `fieldCeiling` above; `null` when either tally is missing for the slug.
 */
export const rollOff = (baseline: MunicipalityFederalBaseline): RollOff | null => {
  const majoritarian = baseline.majoritarian2022?.president
  const federalTally = baseline.federalTallyByYear[String(ELECTION_YEAR_2022)]
  if (!majoritarian || !federalTally) return null

  const dfBlankNull = federalTally.votosBranco + federalTally.votosNulo
  const majoritarianBlankNull = majoritarian.votosBranco + majoritarian.votosNulo
  const votes = dfBlankNull - majoritarianBlankNull
  const percentOfTurnout = federalTally.comparecimento > 0 ? votes / federalTally.comparecimento : null

  return { votes, percentOfTurnout }
}

export type MunicipalityPotential = {
  slug: string
  projectedValidVotes: number
  fieldCeiling2022: number
  projectedFieldCeiling: number
  captureRate2022: number | null
  intraFieldShareByYear: Record<number, number | null>
  rollOff2022: RollOff | null
}

/** Assembles every derived metric above for one catalog municipality slug. */
export const computeMunicipalityPotential = (slug: string): MunicipalityPotential => {
  const baseline = getMunicipalityFederalBaseline(slug)
  const intraFieldShareByYear: Record<number, number | null> = {}
  for (const year of HISTORICAL_SERIES_YEARS) {
    intraFieldShareByYear[year] = intraFieldShare(baseline, year)
  }

  return {
    slug,
    projectedValidVotes: projectedValidVotes(baseline),
    fieldCeiling2022: fieldCeiling(baseline),
    projectedFieldCeiling: projectedFieldCeiling(baseline),
    captureRate2022: captureRate(baseline),
    intraFieldShareByYear,
    rollOff2022: rollOff(baseline),
  }
}

/** `computeMunicipalityPotential` for every catalog municipality (435 slugs). */
export const computeAllMunicipalityPotentials = (): MunicipalityPotential[] =>
  municipalityCatalog.map((entry) => computeMunicipalityPotential(entry.slug))

/** Fallback pessimistic haircut (as a share) when `campaignGoals.margin` is unset. */
const DEFAULT_PESSIMISTIC_HAIRCUT = 0.1

/**
 * `campaignGoals.margin` is a percent (the global's field is "Margem (%)", so
 * `5` means 5%) with only `min: 0` enforced — clamped to [0, 1] as a share so
 * a mistyped 500 can't produce a negative pessimistic goal.
 */
const pessimisticHaircut = (margin: number | null | undefined): number =>
  margin == null ? DEFAULT_PESSIMISTIC_HAIRCUT : Math.min(1, Math.max(0, margin / 100))

/** Own 2022 nominal votes — the anchor of every suggested goal (E9 revision). */
export const ownVotes2022 = (baseline: MunicipalityFederalBaseline): number =>
  votesInYear(baseline, ELECTION_YEAR_2022)

/** Suggested goal for one município across the three scenarios. */
export type SuggestedGoalByScenario = Record<VoteEstimateScenario, number>

/**
 * Suggested goal per município, per scenario, anchored on the candidate's OWN
 * 2022 vote in that município:
 *
 * - `pessimistic` = base × (1 − margin) — losing part of the base
 * - `central`     = base — repeating 2022 where the network already produced
 * - `optimistic`  = base × (stateGoal / Σ base) — growth that closes the seat
 *   account, so Σ optimistic === `stateGoal` exactly
 *
 * The research report's other half — "fração do campo não capturado" — is
 * deliberately NOT folded in: the report conditions it on operational class
 * (defesa carries maintenance, ataque carries growth), which is E10's scope.
 * Until then the open field stays a diagnostic (`captureRate`,
 * `projectedFieldCeiling`). Why the E8 field-ceiling decomposition was
 * replaced: `docs/plans/conta-da-cadeira.md`.
 *
 * `margin` (the coordination's safety reading) is reused as the pessimistic
 * haircut rather than adding a fourth knob to the global.
 *
 * Guard: a `stateGoal` below Σ base would make the optimistic scenario land
 * BELOW central (an "optimistic" that loses votes), so the growth factor is
 * clamped at 1 and `belowBase` says so.
 */
export const deriveSuggestedGoalsByScenario = (
  slugs: ReadonlyArray<string>,
  goals: Pick<CampaignGoal, 'stateGoal' | 'margin'>,
): {
  suggestedGoalBySlug: Map<string, SuggestedGoalByScenario>
  /** Σ of every `central` goal — the "repeat 2022" statewide total. */
  baseTotal: number
  /** `stateGoal / baseTotal`, clamped at 1 (see the guard above). */
  growthFactor: number
  /** True when `stateGoal` is below `baseTotal` and the growth factor was clamped. */
  belowBase: boolean
} => {
  const baseBySlug = new Map<string, number>()
  let baseTotal = 0
  for (const slug of slugs) {
    const base = ownVotes2022(getMunicipalityFederalBaseline(slug))
    baseBySlug.set(slug, base)
    baseTotal += base
  }

  const rawGrowthFactor = baseTotal > 0 ? goals.stateGoal / baseTotal : 1
  const belowBase = baseTotal > 0 && rawGrowthFactor < 1
  const growthFactor = Math.max(1, rawGrowthFactor)
  const haircut = pessimisticHaircut(goals.margin)

  const suggestedGoalBySlug = new Map<string, SuggestedGoalByScenario>()
  for (const [slug, base] of baseBySlug) {
    suggestedGoalBySlug.set(slug, {
      pessimistic: base * (1 - haircut),
      central: base,
      optimistic: base * growthFactor,
    })
  }

  return { suggestedGoalBySlug, baseTotal, growthFactor, belowBase }
}

export type TerritorySanityWarning = {
  region: BahiaIdentityTerritory
  suggestedGoalTotal: number
  projectedValidVotesTotal: number
  /** suggestedGoalTotal / projectedValidVotesTotal — > 1 means the suggested goal exceeds the projected electorate. */
  ratio: number
}

/**
 * Sanity check (never blocking, per the plan): flags identity territories
 * (TI) where the suggested goals, summed, exceed the projected valid-vote
 * electorate of that territory — a signal that the goals need a human look
 * (state goal too high), never a thrown error. Callers surface
 * `warnAboveRatio` as a `CampaignInfoHint`, not a validation failure.
 *
 * Since E9 anchored goals on the candidate's own vote, this is close to
 * inert (his base is a small share of any electorate); the plausibility
 * ceiling the research report actually asks for — Σ pledges above the local
 * FIELD ceiling — is a pledge signal, not a goal one, and belongs to E11.
 */
export const sanityCheckSuggestedGoalsByTerritory = (
  entries: ReadonlyArray<{
    region: BahiaIdentityTerritory
    suggestedGoal: number
    projectedValidVotes: number
  }>,
  { warnAboveRatio = 1 }: { warnAboveRatio?: number } = {},
): TerritorySanityWarning[] => {
  const totalsByRegion = new Map<
    BahiaIdentityTerritory,
    { suggestedGoalTotal: number; projectedValidVotesTotal: number }
  >()

  for (const entry of entries) {
    const current = totalsByRegion.get(entry.region) ?? {
      suggestedGoalTotal: 0,
      projectedValidVotesTotal: 0,
    }
    current.suggestedGoalTotal += entry.suggestedGoal
    current.projectedValidVotesTotal += entry.projectedValidVotes
    totalsByRegion.set(entry.region, current)
  }

  const warnings: TerritorySanityWarning[] = []
  for (const [region, totals] of totalsByRegion) {
    if (totals.projectedValidVotesTotal <= 0) continue
    const ratio = totals.suggestedGoalTotal / totals.projectedValidVotesTotal
    if (ratio > warnAboveRatio) {
      warnings.push({ region, ...totals, ratio })
    }
  }
  return warnings
}

/**
 * Every municipality's potential plus its suggested goal ladder — the single
 * entry point the dashboard/list/detail loaders need
 * (`municipalityGoalAccount.ts`), keyed by slug for O(1) lookup.
 *
 * Deliberately skips `sanityCheckSuggestedGoalsByTerritory`: nothing surfaces
 * `TerritorySanityWarning`s yet (E12's TI layer), so running it on every
 * request would be wasted work.
 */
export const computeStatewideSuggestedGoals = (
  goals: Pick<CampaignGoal, 'stateGoal' | 'margin'>,
): {
  potentialBySlug: Map<string, MunicipalityPotential>
  suggestedGoalBySlug: Map<string, SuggestedGoalByScenario>
} => {
  const potentials = computeAllMunicipalityPotentials()
  const { suggestedGoalBySlug } = deriveSuggestedGoalsByScenario(
    potentials.map((potential) => potential.slug),
    goals,
  )
  const potentialBySlug = new Map(potentials.map((potential) => [potential.slug, potential]))

  return { potentialBySlug, suggestedGoalBySlug }
}
