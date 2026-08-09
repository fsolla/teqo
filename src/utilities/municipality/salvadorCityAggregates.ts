import 'server-only'

import {
  getFederalCompetitiveRank,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
  type FederalCompetitiveRank,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import type { MunicipalityVoteRankEntry } from '@/lib/municipalityVoteRank'
import { DEFAULT_VOTE_RANK_YEAR } from '@/lib/municipalityVoteRank'
import { salvadorCity } from '@/lib/salvadorCity'

/**
 * B178 — Salvador city aggregates folded from the COMMITTED election artifact
 * (the 623 KB `bahia-federal-baseline.json`). Server-only on purpose: this
 * module must never reach the browser bundle — the list row renders the city
 * numbers from the view model, and the client only imports the cheap
 * descriptor/labels from `lib/salvadorCity.ts`.
 *
 * The city never carries its own votes: every number here is a derived VIEW
 * over the 19 zone-slug keys, so the guardrail de dupla contagem holds by
 * construction (the artifact has no `salvador` key; `getStatewideFederalTotals`
 * iterates artifact keys only).
 */

/**
 * The city baseline = the SUM of its 19 zone-slug baselines, folded ONCE per
 * process (the artifact is immutable — same memoization as
 * `getStatewideFederalTotals`). The city never carries its own votes: this is
 * a derived view of the same cells the zones already hold.
 */
let cityBaselineCache: MunicipalityFederalBaseline | null = null

const foldCityFederalBaseline = (): MunicipalityFederalBaseline => {
  const total: MunicipalityFederalBaseline = {
    votesByYear: {},
    validVotesByYear: {},
    campoFederalVotesByYear: {},
    federalTallyByYear: {},
  }
  let majoritarian: MunicipalityFederalBaseline['majoritarian2022'] | undefined

  for (const slug of salvadorCity.zoneSlugs) {
    const zone = getMunicipalityFederalBaseline(slug)
    for (const [yearKey, votes] of Object.entries(zone.votesByYear)) {
      total.votesByYear[yearKey] = (total.votesByYear[yearKey] ?? 0) + votes
    }
    for (const [yearKey, votes] of Object.entries(zone.validVotesByYear)) {
      total.validVotesByYear[yearKey] = (total.validVotesByYear[yearKey] ?? 0) + votes
    }
    for (const [yearKey, votes] of Object.entries(zone.campoFederalVotesByYear)) {
      total.campoFederalVotesByYear[yearKey] = (total.campoFederalVotesByYear[yearKey] ?? 0) + votes
    }
    for (const [yearKey, tally] of Object.entries(zone.federalTallyByYear)) {
      const accumulated = total.federalTallyByYear[yearKey] ?? {
        comparecimento: 0,
        votosValidos: 0,
        votosBranco: 0,
        votosNulo: 0,
      }
      total.federalTallyByYear[yearKey] = {
        comparecimento: accumulated.comparecimento + tally.comparecimento,
        votosValidos: accumulated.votosValidos + tally.votosValidos,
        votosBranco: accumulated.votosBranco + tally.votosBranco,
        votosNulo: accumulated.votosNulo + tally.votosNulo,
      }
    }
    if (zone.majoritarian2022) {
      const sum = (
        current: {
          votes: number
          comparecimento: number
          votosValidos: number
          votosBranco: number
          votosNulo: number
        },
        cell: {
          votes: number
          comparecimento: number
          votosValidos: number
          votosBranco: number
          votosNulo: number
        },
      ) => ({
        votes: current.votes + cell.votes,
        comparecimento: current.comparecimento + cell.comparecimento,
        votosValidos: current.votosValidos + cell.votosValidos,
        votosBranco: current.votosBranco + cell.votosBranco,
        votosNulo: current.votosNulo + cell.votosNulo,
      })
      if (!majoritarian) {
        majoritarian = {
          president: sum(
            { votes: 0, comparecimento: 0, votosValidos: 0, votosBranco: 0, votosNulo: 0 },
            zone.majoritarian2022.president,
          ),
          governor: sum(
            { votes: 0, comparecimento: 0, votosValidos: 0, votosBranco: 0, votosNulo: 0 },
            zone.majoritarian2022.governor,
          ),
        }
      } else {
        majoritarian.president = sum(majoritarian.president, zone.majoritarian2022.president)
        majoritarian.governor = sum(majoritarian.governor, zone.majoritarian2022.governor)
      }
    }
  }

  if (majoritarian) total.majoritarian2022 = majoritarian
  return total
}

export const cityFederalBaseline = (): MunicipalityFederalBaseline => {
  if (!cityBaselineCache) cityBaselineCache = foldCityFederalBaseline()
  return cityBaselineCache
}

/** Share of the candidate's statewide (artifact) votes that came from Salvador, per year — 0..1. */
export const cityVoteShareByYear = (year: number): number => {
  const ownVotes = getStatewideFederalTotals(year).ownVotes
  if (ownVotes <= 0) return 0
  return (cityFederalBaseline().votesByYear[String(year)] ?? 0) / ownVotes
}

/**
 * Competitive placement of the candidate INSIDE the capital for one year
 * ("12º de 663" — the per-city rank the artifact keys by IBGE code). `null`
 * when he took no votes there that year — never a fabricated last place.
 */
export const cityCompetitiveRank = (year: number): FederalCompetitiveRank | null =>
  getFederalCompetitiveRank(salvadorCity.ibgeCode, year)

/**
 * The list column's readout entry for the city: votes + share of own vote +
 * the city's COMPETITIVE position ("mesmos números do rollup" of the page).
 * `null` when the year has no competitive rank (renders the column dash).
 */
export const cityVoteRankEntry = (
  year: number = DEFAULT_VOTE_RANK_YEAR,
): MunicipalityVoteRankEntry | null => {
  const competitive = cityCompetitiveRank(year)
  if (!competitive) return null
  return {
    votes: cityFederalBaseline().votesByYear[String(year)] ?? 0,
    share: cityVoteShareByYear(year),
    rank: competitive.rank,
    totalUnits: competitive.candidates,
  }
}

/**
 * Vote entry used ONLY for ordering (`votos` sort): the city sorts by its
 * real summed votes even when a year lacks a competitive rank. Never rendered.
 */
export const citySortVoteEntry = (
  year: number = DEFAULT_VOTE_RANK_YEAR,
): MunicipalityVoteRankEntry => ({
  votes: cityFederalBaseline().votesByYear[String(year)] ?? 0,
  share: cityVoteShareByYear(year),
  rank: 0,
  totalUnits: 0,
})
