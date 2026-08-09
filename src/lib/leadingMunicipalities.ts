/**
 * Reversed competitive rank for the Sollinha chat: given a federal deputy
 * (default: the campaign candidate), answer "in which municipalities was he
 * the most voted (or up to top-N)" for a year of the TSE series.
 *
 * Pure module — no server/database imports. Two producers share one output
 * shape and the SAME rank semantics the map paints:
 *   - the campaign candidate reads the committed immutable artifact
 *     (`getFederalCompetitiveRank` + `getMunicipalityFederalBaseline`), which
 *     is exactly the map's source;
 *   - any other federal deputy derives live from the TSE collections via a
 *     single SQL window query (see the ai tool in
 *     `src/utilities/ai/tools/getLeadingMunicipalities.ts`).
 *
 * Rank semantics (pinned to the artifact builder in
 * `scripts/build-election-aggregates.mjs`): rank = candidates strictly ahead
 * + 1 (ties share a placement), the denominator is the candidates with at
 * least one vote in the city, a city where the candidate took no votes yields
 * no row, and every city appears exactly once — Salvador's 19 zone
 * municipalities fold into a single city row.
 */

import {
  getFederalCompetitiveRank,
  getMunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import {
  municipalityCatalog,
  municipalityCatalogEntriesForCity,
  type MunicipalityCatalogEntry,
} from '@/lib/municipalityCatalog'

export type LeadingMunicipalityRow = {
  /** Canonical city name where the candidate placed at or above top-N. */
  city: string
  /**
   * Canonical municipality slug for a city-level page link, or `null` when the
   * city has no single-municipality page (Salvador is 19 zone units — a city
   * ranking must not point at a zone page).
   */
  slug: string | null
  /** Placement among the federal deputies voted in the city (1 = most voted). */
  rank: number
  /** Federal deputies with at least one vote in the city — the "de N candidatos" denominator. */
  votedCandidates: number
  /** The candidate's nominal votes inside the city geography (zones folded). */
  votes: number
}

export type LeadingMunicipalitiesResult = {
  candidate: { candidateNumber: number; name: string; party: string | null }
  year: number
  topN: number
  /** Number of cities where the candidate placed at or above top-N. */
  total: number
  municipalities: LeadingMunicipalityRow[]
}

/** Sorts by placement asc, then votes desc — both producers present the same order. */
export const sortLeadingMunicipalityRows = (
  rows: readonly LeadingMunicipalityRow[],
): LeadingMunicipalityRow[] =>
  [...rows].sort((left, right) => left.rank - right.rank || right.votes - left.votes)

/**
 * City-level page slug for a ranking row: a city with exactly one catalog unit
 * links its municipality page; a city split into zone units (Salvador, 19)
 * has no single page and stays `null`. The single spelling of the row rule.
 */
export const cityPageSlug = (entries: readonly MunicipalityCatalogEntry[]): string | null =>
  entries.length === 1 ? entries[0]!.slug : null

const cityNames = () => new Set(municipalityCatalog.map((entry) => entry.city))

/**
 * The campaign candidate's reversed ranking straight from the committed
 * artifact — instant, immutable, exactly the map's competitive placement.
 * `topN` is not clamped here: the tool clamps before calling.
 */
export const campaignCandidateLeadingMunicipalities = (
  year: number,
  topN: number,
): LeadingMunicipalitiesResult => {
  const rows: LeadingMunicipalityRow[] = []

  for (const city of cityNames()) {
    const entries = municipalityCatalogEntriesForCity(city)
    const first = entries[0]!
    const competitive = getFederalCompetitiveRank(first.ibgeCode, year)
    if (!competitive || competitive.rank > topN) continue

    let votes = 0
    for (const entry of entries) {
      votes += getMunicipalityFederalBaseline(entry.slug).votesByYear[String(year)] ?? 0
    }

    rows.push({
      city,
      // A city with more than one catalog unit (Salvador, 19 zones) shares one
      // placement and has no single page to link — the zone slugs stay hidden.
      slug: cityPageSlug(entries),
      rank: competitive.rank,
      votedCandidates: competitive.candidates,
      votes,
    })
  }

  return {
    candidate: {
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
      name: BASELINE_TICKET_2022.candidate.name,
      party: BASELINE_TICKET_2022.candidate.party,
    },
    year,
    topN,
    total: rows.length,
    municipalities: sortLeadingMunicipalityRows(rows),
  }
}
