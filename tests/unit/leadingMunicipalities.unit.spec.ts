import type { CampaignUser } from '@/payload-types'
import { describe, expect, it } from 'vitest'

import { BASELINE_TICKET_2022, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import {
  campaignCandidateLeadingMunicipalities,
  sortLeadingMunicipalityRows,
  type LeadingMunicipalityRow,
} from '@/lib/leadingMunicipalities'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'

import { stub } from '../helpers/stub'

describe('campaignCandidateLeadingMunicipalities (B177 artifact path)', () => {
  it('renders the Solla 2022 rank-1 set with one line per city', () => {
    const result = campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 1)

    expect(result.candidate.candidateNumber).toBe(BASELINE_TICKET_2022.candidate.candidateNumber)
    expect(result.year).toBe(ELECTION_YEAR_2022)
    expect(result.topN).toBe(1)
    expect(result.total).toBe(result.municipalities.length)
    expect(result.total).toBeGreaterThan(0)

    const cities = result.municipalities.map((row) => row.city)
    expect(new Set(cities).size).toBe(cities.length)

    for (const row of result.municipalities) {
      expect(row.rank).toBe(1)
      expect(row.votes).toBeGreaterThan(0)
      expect(row.votedCandidates).toBeGreaterThanOrEqual(1)
      if (row.city === 'Salvador') {
        expect(row.slug).toBeNull()
      } else {
        expect(row.slug).toBeTruthy()
      }
    }
  })

  it('orders placements asc, then votes desc', () => {
    const result = campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 3)
    const ranks = result.municipalities.map((row) => row.rank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    for (let index = 1; index < ranks.length; index += 1) {
      if (ranks[index - 1] === ranks[index]) {
        expect(result.municipalities[index - 1]!.votes).toBeGreaterThanOrEqual(
          result.municipalities[index]!.votes,
        )
      }
    }
  })

  it('a deeper top-N is a superset of a shallower one (same source)', () => {
    const top1 = new Set(
      campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 1).municipalities.map(
        (row) => row.city,
      ),
    )
    const top3Cities = new Set(
      campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 3).municipalities.map(
        (row) => row.city,
      ),
    )
    for (const city of top1) expect(top3Cities.has(city)).toBe(true)
  })

  it('Salvador folds into one row and never links a zone page', () => {
    const result = campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 20)
    const salvador = result.municipalities.filter((row) => row.city === 'Salvador')
    expect(salvador.length).toBeLessThanOrEqual(1)
    if (salvador[0]) {
      expect(salvador[0]?.slug).toBeNull()
    }
    const pageSlugs = result.municipalities
      .filter((row) => row.slug !== null)
      .map((row) => row.slug)
    expect(new Set(pageSlugs).size).toBe(pageSlugs.length)
  })

  it('links the catalog slug that resolves back to the same canonical city', () => {
    const result = campaignCandidateLeadingMunicipalities(ELECTION_YEAR_2022, 1)
    const linked = result.municipalities.find((row) => row.slug !== null)
    expect(linked).toBeDefined()
    expect(getMunicipalityCatalogEntry(linked!.slug!)?.city).toBe(linked?.city)
  })
})

describe('sortLeadingMunicipalityRows', () => {
  it('orders by rank asc and votes desc within a tie', () => {
    const rows: LeadingMunicipalityRow[] = [
      { city: 'A', slug: 'a', rank: 1, votedCandidates: 2, votes: 100 },
      { city: 'B', slug: 'b', rank: 2, votedCandidates: 2, votes: 900 },
      { city: 'C', slug: 'c', rank: 1, votedCandidates: 2, votes: 300 },
      { city: 'D', slug: 'd', rank: 2, votedCandidates: 2, votes: 500 },
    ]
    expect(sortLeadingMunicipalityRows(rows).map((row) => row.city)).toEqual(['C', 'A', 'B', 'D'])
  })

  it('does not mutate the input', () => {
    const rows: LeadingMunicipalityRow[] = [
      { city: 'X', slug: null, rank: 2, votedCandidates: 2, votes: 10 },
      { city: 'Y', slug: 'y', rank: 1, votedCandidates: 2, votes: 10 },
    ]
    sortLeadingMunicipalityRows(rows)
    expect(rows[0]?.city).toBe('X')
  })
})

describe('leader lockdown (B177)', () => {
  it('assertCanReadElectionData rejects a leader and accepts staff', () => {
    const leader = stub<CampaignUser>({ collection: 'campaignUser', role: 'leader' })
    const coordinator = stub<CampaignUser>({ collection: 'campaignUser', role: 'coordinator' })
    expect(() => assertCanReadElectionData(leader)).toThrow('Leitura de dados eleitorais negada')
    expect(() => assertCanReadElectionData(coordinator)).not.toThrow()
  })
})
