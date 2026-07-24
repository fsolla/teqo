import { describe, expect, it } from 'vitest'

import {
  FEDERAL_BASELINE_CANDIDATE_NUMBER,
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'

/**
 * Pins the committed election-aggregate artifact to the municipality catalog.
 * If either changes shape (new remodel, new TSE scope), regenerate with
 * `pnpm build:election-aggregates` — a drift here means the map would render
 * zeros silently.
 */
describe('election aggregates artifact', () => {
  it('covers exactly the municipality catalog slugs', () => {
    const artifactSlugs = new Set(federalBaselineMunicipalitySlugs())
    const catalogSlugs = new Set(municipalityCatalog.map((entry) => entry.slug))

    expect(artifactSlugs.size).toBe(catalogSlugs.size)
    for (const slug of catalogSlugs) {
      expect(artifactSlugs.has(slug)).toBe(true)
    }
  })

  it('is generated for the baseline ticket candidate', () => {
    expect(FEDERAL_BASELINE_CANDIDATE_NUMBER).toBe(BASELINE_TICKET_2022.candidate.candidateNumber)
  })

  it('has every historical year populated with plausible statewide totals', () => {
    for (const year of HISTORICAL_SERIES_YEARS) {
      let candidateTotal = 0
      let validTotal = 0
      for (const slug of federalBaselineMunicipalitySlugs()) {
        const baseline = getMunicipalityFederalBaseline(slug)
        const votes = baseline.votesByYear[String(year)]
        const valid = baseline.validVotesByYear[String(year)]
        expect(votes).toBeTypeOf('number')
        expect(valid).toBeTypeOf('number')
        expect(votes).toBeGreaterThanOrEqual(0)
        expect(valid).toBeGreaterThanOrEqual(votes > 0 ? 1 : 0)
        candidateTotal += votes ?? 0
        validTotal += valid ?? 0
      }
      // A statewide federal-deputy campaign always lands in the 5-7 digit range.
      expect(candidateTotal).toBeGreaterThan(10_000)
      expect(validTotal).toBeGreaterThan(candidateTotal)
    }
  })

  it('returns an empty baseline for unknown slugs', () => {
    const baseline = getMunicipalityFederalBaseline('nao-existe')
    expect(baseline.votesByYear).toEqual({})
    expect(baseline.validVotesByYear).toEqual({})
  })
})
