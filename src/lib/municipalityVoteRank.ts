import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '@/lib/bahiaElectionAggregates'
import { formatElectionNumber } from '@/lib/electionFormat'

/** Year the mesa uses as the current priority lens (A11 list sort + default readout). */
export const DEFAULT_VOTE_RANK_YEAR = 2022

export type MunicipalityVoteRankEntry = {
  rank: number
  votes: number
  /** Fraction of the candidate's statewide (artifact) total for the year — 0..1. */
  share: number
  totalUnits: number
}

const rankByYearCache = new Map<number, ReadonlyMap<string, MunicipalityVoteRankEntry>>()

/**
 * Dense rank + share of own statewide vote for every catalog municipality slug
 * in the committed federal baseline artifact. Ties share a rank; the next
 * distinct total gets the next consecutive rank (no gaps).
 *
 * Cached at module scope — the artifact is immutable for the process lifetime.
 */
export const computeVoteRankByYear = (
  year: number,
): ReadonlyMap<string, MunicipalityVoteRankEntry> => {
  const cached = rankByYearCache.get(year)
  if (cached) return cached

  const yearKey = String(year)
  const slugs = federalBaselineMunicipalitySlugs()
  const rows = slugs.map((slug) => ({
    slug,
    votes: getMunicipalityFederalBaseline(slug).votesByYear[yearKey] ?? 0,
  }))

  const candidateTotal = getStatewideFederalTotals(year).ownVotes

  rows.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    return a.slug.localeCompare(b.slug)
  })

  const totalUnits = rows.length
  const bySlug = new Map<string, MunicipalityVoteRankEntry>()
  let denseRank = 0
  let previousVotes: number | undefined

  for (const row of rows) {
    if (row.votes !== previousVotes) {
      denseRank += 1
      previousVotes = row.votes
    }
    bySlug.set(row.slug, {
      rank: denseRank,
      votes: row.votes,
      share: candidateTotal > 0 ? row.votes / candidateTotal : 0,
      totalUnits,
    })
  }

  rankByYearCache.set(year, bySlug)
  return bySlug
}

export const getMunicipalityVoteRank = (
  slug: string,
  year: number = DEFAULT_VOTE_RANK_YEAR,
): MunicipalityVoteRankEntry | null => computeVoteRankByYear(year).get(slug) ?? null

export const formatMunicipalityVoteRank = (rank: number): string => `${formatElectionNumber(rank)}º`

/** Compare for list sort=votos. Zero-vote rows always sort last (any dir). */
export const compareMunicipalityVotesForSort = (
  aVotes: number,
  bVotes: number,
  dir: 'asc' | 'desc',
): number => {
  const aZero = aVotes === 0
  const bZero = bVotes === 0
  if (aZero !== bZero) return aZero ? 1 : -1
  const cmp = aVotes - bVotes
  return dir === 'asc' ? cmp : -cmp
}
