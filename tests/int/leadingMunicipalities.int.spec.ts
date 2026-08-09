// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { municipalityForTseCityCode } from '@/lib/bahiaTseCityCodes'
import { ELECTION_YEAR_2022 } from '@/lib/electionResults'
import type { BuiltElectionResults } from '@/lib/electionResultsBuild'
import { cityPageSlug, type LeadingMunicipalityRow } from '@/lib/leadingMunicipalities'
import { municipalityCatalogEntriesForCity } from '@/lib/municipalityCatalog'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import {
  loadLeadingMunicipalitiesForCandidate,
  resolveFederalDeputy,
} from '@/utilities/ai/tools/getLeadingMunicipalities'
import { buildImportBundles, importElectionBundles } from '@/utilities/electionResultsImport'

import { stub } from '../helpers/stub'
import {
  acquireTestDatabaseLease,
  ELECTION_COLLECTIONS_LEASE_KEY,
  type TestDatabaseLease,
} from '../helpers/testDatabaseLease'
import { loadTseFixtureResults } from '../helpers/tseFixtures'

let payload: Payload
let electionCollectionsLease: TestDatabaseLease

const staffUser = stub<CampaignUser>({ collection: 'campaignUser', role: 'coordinator' })

const deleteAllElectionData = async () => {
  for (const collection of [
    'electionCandidateVote',
    'electionTally',
    'electionCandidate',
  ] as const) {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const doc of existing.docs) {
      await payload.delete({ collection, id: doc.id, overrideAccess: true })
    }
  }
}

const importFixture2022 = async () =>
  importElectionBundles(payload, buildImportBundles(loadTseFixtureResults()))

const loadRows = (candidateNumber: number, topN: number): Promise<LeadingMunicipalityRow[]> =>
  loadLeadingMunicipalitiesForCandidate(payload, staffUser, {
    candidateNumber,
    year: ELECTION_YEAR_2022,
    topN,
  })

/**
 * In-memory re-statement of the artifact builder's rank formula
 * (`scripts/build-election-aggregates.mjs`): rank = candidates strictly ahead
 * + 1, denominator = candidates with votes > 0, no row when the target has no
 * votes in the city. The int test asserts the SQL window query produces
 * exactly this — pinning "same semantics as the map" without shipping a
 * second ranker.
 */
const rankFromBuiltVotes = (
  built: BuiltElectionResults,
  candidateNumber: number,
  topN: number,
): Map<string, { rank: number; votedCandidates: number; votes: number }> => {
  const byCity = new Map<string, Map<number, number>>()
  for (const row of built.votes) {
    if (
      row.office !== 'deputado_federal' ||
      row.turn !== '1' ||
      row.voteType !== 'nominal' ||
      row.votes <= 0
    ) {
      continue
    }
    let byCandidate = byCity.get(row.cityCode)
    if (!byCandidate) {
      byCandidate = new Map()
      byCity.set(row.cityCode, byCandidate)
    }
    byCandidate.set(row.candidateNumber, (byCandidate.get(row.candidateNumber) ?? 0) + row.votes)
  }

  const expected = new Map<string, { rank: number; votedCandidates: number; votes: number }>()
  for (const [cityCode, byCandidate] of byCity) {
    const ownVotes = byCandidate.get(candidateNumber)
    if (!ownVotes || ownVotes <= 0) continue

    let ahead = 0
    let votedCandidates = 0
    for (const votes of byCandidate.values()) {
      if (votes <= 0) continue
      votedCandidates += 1
      if (votes > ownVotes) ahead += 1
    }

    const rank = ahead + 1
    if (rank <= topN) {
      expected.set(cityCode, { rank, votedCandidates, votes: ownVotes })
    }
  }
  return expected
}

describe('getLeadingMunicipalities — live SQL path and candidate resolution (B177)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    // The import spec wipes every election row; this lease serializes the
    // fixture window against the other election-collection specs.
    electionCollectionsLease = await acquireTestDatabaseLease(
      payload,
      ELECTION_COLLECTIONS_LEASE_KEY,
    )
    await deleteAllElectionData()
    await importFixture2022()
  }, 120_000)

  afterAll(async () => {
    await deleteAllElectionData()
    await electionCollectionsLease.release()
  }, 120_000)

  it('folds Salvador zones into one city row with exact ranks and votes', async () => {
    const rows = await loadRows(1313, 1)

    expect(rows).toEqual([
      {
        city: 'Salvador',
        slug: null,
        rank: 1,
        votedCandidates: 2,
        votes: 2100,
      },
      {
        city: 'Feira de Santana',
        slug: cityPageSlug(municipalityCatalogEntriesForCity('Feira de Santana')),
        rank: 1,
        votedCandidates: 2,
        votes: 500,
      },
    ])
  })

  it('top-N widens a candidate who never reached rank 1', async () => {
    expect(await loadRows(2222, 1)).toEqual([])

    const top2 = await loadRows(2222, 2)
    expect(top2.map((row) => [row.city, row.rank, row.votes])).toEqual([
      ['Salvador', 2, 1900],
      ['Feira de Santana', 2, 300],
    ])
  })

  it('matches the in-memory artifact-builder formula on the same fixture rows', async () => {
    const expected = rankFromBuiltVotes(loadTseFixtureResults(), 1313, 20)

    const cityCodeByCity = new Map<string, string>()
    for (const cityCode of expected.keys()) {
      const city = municipalityForTseCityCode(cityCode)
      if (city) cityCodeByCity.set(city, cityCode)
    }
    // Non-vacuous: every expected city must resolve to a canonical name, so a
    // wrong fixture code can no longer hide the city from both sides.
    expect(cityCodeByCity.size).toBe(expected.size)

    const rows = await loadRows(1313, 20)

    expect(new Set(rows.map((row) => row.city))).toEqual(new Set(cityCodeByCity.keys()))
    for (const row of rows) {
      const cityCode = cityCodeByCity.get(row.city)
      expect(cityCode, row.city).toBeDefined()
      const expectedRow = expected.get(cityCode!)!
      expect(row.rank).toBe(expectedRow.rank)
      expect(row.votedCandidates).toBe(expectedRow.votedCandidates)
      expect(row.votes).toBe(expectedRow.votes)
    }
  })

  it('resolves the campaign candidate by ballot number and by name', async () => {
    await expect(resolveFederalDeputy(payload, ELECTION_YEAR_2022, '1313')).resolves.toEqual({
      candidateNumber: 1313,
      name: 'JORGE SOLLA',
      party: 'PT',
    })
    await expect(resolveFederalDeputy(payload, ELECTION_YEAR_2022, 'Jorge Solla')).resolves.toEqual(
      { candidateNumber: 1313, name: 'JORGE SOLLA', party: 'PT' },
    )
  })

  it('resolves a rival by ballot number and by urn name', async () => {
    await expect(resolveFederalDeputy(payload, ELECTION_YEAR_2022, '2222')).resolves.toEqual({
      candidateNumber: 2222,
      name: 'RIVAL FEDERAL',
      party: 'PL',
    })
    await expect(
      resolveFederalDeputy(payload, ELECTION_YEAR_2022, 'RIVAL FEDERAL'),
    ).resolves.toEqual({ candidateNumber: 2222, name: 'RIVAL FEDERAL', party: 'PL' })
  })

  it('falls back to the vote rows when the candidate registry misses', async () => {
    // Drop 2222 from the registry only — the vote rows stay — so resolution
    // takes the fallback path instead of the registry.
    await payload.delete({
      collection: 'electionCandidate',
      where: {
        and: [{ year: { equals: ELECTION_YEAR_2022 } }, { candidateNumber: { equals: 2222 } }],
      },
      overrideAccess: true,
    })

    await expect(resolveFederalDeputy(payload, ELECTION_YEAR_2022, '2222')).resolves.toEqual({
      candidateNumber: 2222,
      name: 'RIVAL FEDERAL',
      party: 'PL',
    })

    // Restore the fixture so later file-scoped reads see a consistent registry.
    await importFixture2022()
  })

  it('reports a not-found candidate without inventing a number', async () => {
    const resolution = await resolveFederalDeputy(payload, ELECTION_YEAR_2022, 'NINGUEM')
    expect('error' in resolution && !('options' in resolution)).toBe(true)
  })
})
