import { describe, expect, it } from 'vitest'

import { federalBaselineMunicipalitySlugs } from '@/lib/bahiaElectionAggregates'
import { formatVoteSharePercent } from '@/lib/electionFormat'
import {
  compareMunicipalityVotesForSort,
  computeVoteRankByYear,
  DEFAULT_VOTE_RANK_YEAR,
  formatMunicipalityVoteRank,
  getMunicipalityVoteRank,
} from '@/lib/municipalityVoteRank'

describe('municipalityVoteRank', () => {
  it('ranks every catalog slug for the default year', () => {
    const bySlug = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
    const slugs = federalBaselineMunicipalitySlugs()
    expect(bySlug.size).toBe(slugs.length)
    expect(bySlug.size).toBe(435)

    let shareSum = 0
    for (const slug of slugs) {
      const entry = bySlug.get(slug)
      expect(entry).toBeDefined()
      expect(entry!.totalUnits).toBe(435)
      expect(entry!.rank).toBeGreaterThanOrEqual(1)
      expect(entry!.rank).toBeLessThanOrEqual(435)
      expect(entry!.votes).toBeGreaterThanOrEqual(0)
      expect(entry!.share).toBeGreaterThanOrEqual(0)
      shareSum += entry!.share
    }
    expect(shareSum).toBeCloseTo(1, 10)
  })

  it('uses dense ranks when votes tie', () => {
    const bySlug = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
    const byVotes = new Map<number, number[]>()
    for (const entry of bySlug.values()) {
      const ranks = byVotes.get(entry.votes) ?? []
      ranks.push(entry.rank)
      byVotes.set(entry.votes, ranks)
    }
    for (const ranks of byVotes.values()) {
      expect(new Set(ranks).size).toBe(1)
    }

    const sortedUniqueVotes = [...byVotes.keys()].sort((a, b) => b - a)
    let expectedDense = 1
    for (const votes of sortedUniqueVotes) {
      const rank = byVotes.get(votes)![0]!
      expect(rank).toBe(expectedDense)
      expectedDense += 1
    }
  })

  it('returns null for unknown slugs', () => {
    expect(getMunicipalityVoteRank('nao-existe')).toBeNull()
  })

  it('formats rank as colocação only (catalog size lives in the header hint)', () => {
    expect(formatMunicipalityVoteRank(12)).toBe('12º')
    expect(formatVoteSharePercent(0.031)).toMatch(/3[,.]1%/)
  })

  it('sorts zero votes last in either direction', () => {
    expect(compareMunicipalityVotesForSort(0, 100, 'desc')).toBeGreaterThan(0)
    expect(compareMunicipalityVotesForSort(0, 100, 'asc')).toBeGreaterThan(0)
    expect(compareMunicipalityVotesForSort(200, 100, 'desc')).toBeLessThan(0)
    expect(compareMunicipalityVotesForSort(50, 100, 'asc')).toBeLessThan(0)
  })
})
