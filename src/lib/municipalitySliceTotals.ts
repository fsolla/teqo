import { computeVoteRankByYear, DEFAULT_VOTE_RANK_YEAR } from '@/lib/municipalityVoteRank'
import { SALVADOR_CITY_SLUG, salvadorCity } from '@/lib/salvadorCity'
import {
  hasAnyVoteEstimate,
  toVoteEstimateScenarioViewModel,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenarioFields,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

/**
 * B202 — the only shape the slice totals need from a row. The scoped docs the
 * loader sums and the list view models both satisfy it, so the sum can read
 * whatever set already produced the visible rows.
 */
export type MunicipalitySliceTotalsRow = {
  slug: string
  expectedVotes?: VoteEstimateScenarioFields | null
}

export type MunicipalitySliceTotals = {
  /** Rows of the slice — the same set the footer count shows. */
  rowCount: number
  /** Solla 2022 votes over the slice; the city replaces its 19 ZE when present. */
  votes2022: number
  /** Per scenario: `null` when no row of the slice filled it (never a fake zero). */
  expectedByScenario: VoteEstimateScenarioViewModel
  /** Rows with at least one scenario filled — the numerator of "N de M com expectativa". */
  withEstimateCount: number
}

const salvadorZoneSlugs: ReadonlySet<string> = new Set(salvadorCity.zoneSlugs)

/**
 * Totals of the WHOLE filtered slice (every page), summed over the same docs
 * the rows came from — the sum never re-derives scope. Pure and honest:
 *
 * - 2022 uses the same per-slug source as the row column
 *   (`computeVoteRankByYear`), so the sum matches the lines by construction.
 * - Salvador counts once: when the city row is in the slice, its 19 zone votes
 *   enter once as the fold and the zone rows are skipped; with only zones, they
 *   sum normally. The city carries no expectation of its own, so the zone
 *   EXPECTATIONS always sum row by row.
 * - A scenario nobody filled stays `null` (the UI renders "—"), while filled
 *   values — including explicit zeros — sum.
 * - An empty slice returns `null`: no invented totals.
 */
export const computeMunicipalitySliceTotals = (
  rows: readonly MunicipalitySliceTotalsRow[],
): MunicipalitySliceTotals | null => {
  if (rows.length === 0) return null

  const ranks = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
  const cityInSlice = rows.some((row) => row.slug === SALVADOR_CITY_SLUG)

  const expectedByScenario: VoteEstimateScenarioViewModel = {
    pessimistic: null,
    central: null,
    optimistic: null,
  }
  let votes2022 = 0
  let withEstimateCount = 0

  // The city has no artifact entry of its own: its votes are the fold of the
  // 19 zone cells, added ONCE whether or not the zones ride along.
  if (cityInSlice) {
    for (const zoneSlug of salvadorCity.zoneSlugs) {
      votes2022 += ranks.get(zoneSlug)?.votes ?? 0
    }
  }

  for (const row of rows) {
    // Only the VOTES need the city-or-zones choice; expectations sum for every
    // row (the city carries none, so its 19 ZE are the only source).
    if (!(cityInSlice && (row.slug === SALVADOR_CITY_SLUG || salvadorZoneSlugs.has(row.slug)))) {
      votes2022 += ranks.get(row.slug)?.votes ?? 0
    }

    const estimates = toVoteEstimateScenarioViewModel(row.expectedVotes)
    if (hasAnyVoteEstimate(estimates)) withEstimateCount += 1
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      const value = estimates[scenario]
      if (value == null) continue
      expectedByScenario[scenario] = (expectedByScenario[scenario] ?? 0) + value
    }
  }

  return { rowCount: rows.length, votes2022, expectedByScenario, withEstimateCount }
}
