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

/**
 * E8 "conta da cadeira" — derived electoral potential per municipality, built
 * entirely from the committed `bahia-federal-baseline.json` artifact (no DB
 * reads: pure functions over `getMunicipalityFederalBaseline`). Every
 * projection here is a documented, fixed formula — never a fitted model (see
 * the E8 plan's "rabbit holes vigiados": projection turning into a model).
 */

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
 * the E8 plan). 2022-only: no majoritarian tally is seeded for 2014/2018.
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
  const votes2022 = baseline.votesByYear[String(ELECTION_YEAR_2022)] ?? 0
  return votes2022 / ceiling
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
  const votes = baseline.votesByYear[String(year)] ?? 0
  return votes / campo
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
 * and as a share of comparecimento. 2022-only (no majoritarian tally for
 * 2014/2018); `null` when either tally is missing for the slug.
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

/**
 * Decomposes the state goal proportionally to each municipality's projected
 * field ceiling — `suggestedGoal_i = stateGoal × projectedFieldCeiling_i / Σ
 * projectedFieldCeiling` — NOT a composite formula folding in capture rate or
 * intra-field share (those stay diagnostic columns; see the E8 plan's
 * "rabbit holes vigiados"). `margin` on the `campaignGoals` global is
 * informational for the table (a safety reading for the coordination), it
 * does not change the decomposed value.
 *
 * Falls back to an even split when every ceiling is zero/unknown (e.g. an
 * empty potentials list slice) rather than producing `NaN` suggested goals.
 */
export const decomposeStateGoal = (
  potentials: ReadonlyArray<Pick<MunicipalityPotential, 'slug' | 'projectedFieldCeiling'>>,
  goals: Pick<CampaignGoal, 'stateGoal'>,
): Map<string, number> => {
  const stateGoal = goals.stateGoal
  const totalCeiling = potentials.reduce((sum, entry) => sum + entry.projectedFieldCeiling, 0)
  const suggestedGoalBySlug = new Map<string, number>()

  if (totalCeiling <= 0) {
    const even = potentials.length > 0 ? stateGoal / potentials.length : 0
    for (const entry of potentials) suggestedGoalBySlug.set(entry.slug, even)
    return suggestedGoalBySlug
  }

  for (const entry of potentials) {
    suggestedGoalBySlug.set(entry.slug, stateGoal * (entry.projectedFieldCeiling / totalCeiling))
  }
  return suggestedGoalBySlug
}

export type TerritorySanityWarning = {
  region: BahiaIdentityTerritory
  suggestedGoalTotal: number
  projectedValidVotesTotal: number
  /** suggestedGoalTotal / projectedValidVotesTotal — > 1 means the decomposed goal exceeds the projected electorate. */
  ratio: number
}

/**
 * Sanity check (never blocking, per the plan): flags identity territories
 * (TI) where the decomposed suggested goals, summed, exceed the projected
 * valid-vote electorate of that territory — a signal that the decomposition
 * needs a human look (state goal too high, or ceilings skewed), never a
 * thrown error. Callers surface `warnAboveRatio` as an `CampaignInfoHint`,
 * not a validation failure.
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
 * Convenience end-to-end: computes every municipality's potential and
 * decomposes the state goal — the single entry point the dashboard/list/
 * detail loaders need (`municipalityGoalAccount.ts`), keyed by slug for O(1)
 * per-municipality lookup instead of a linear scan.
 *
 * Deliberately does NOT run `sanityCheckSuggestedGoalsByTerritory` here: no
 * caller surfaces `TerritorySanityWarning`s yet (deferred to E12's TI layer
 * — see the E8 plan), so computing them on every dashboard/list/detail
 * request would be pure wasted work. Callers that need the check once E12
 * lands can build the same `{ region, suggestedGoal, projectedValidVotes }`
 * entries from `potentialBySlug` + `municipalityCatalog` and call it
 * directly — it stays exported and unit-tested for that.
 */
export const computeStatewideGoalDecomposition = (
  goals: Pick<CampaignGoal, 'stateGoal'>,
): {
  potentialBySlug: Map<string, MunicipalityPotential>
  suggestedGoalBySlug: Map<string, number>
} => {
  const potentials = computeAllMunicipalityPotentials()
  const suggestedGoalBySlug = decomposeStateGoal(potentials, goals)
  const potentialBySlug = new Map(potentials.map((potential) => [potential.slug, potential]))

  return { potentialBySlug, suggestedGoalBySlug }
}
