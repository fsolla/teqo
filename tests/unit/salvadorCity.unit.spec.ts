import { describe, expect, it } from 'vitest'

import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '@/lib/bahiaElectionAggregates'
import { ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { isCitySlug, salvadorCity } from '@/lib/salvadorCity'
import {
  cityCompetitiveRank,
  cityFederalBaseline,
  cityVoteRankEntry,
} from '@/utilities/municipality/salvadorCityAggregates'

/**
 * B178 — the Salvador city aggregate is a DERIVED view of the 19 zone
 * municipalities. The guardrail de dupla contagem lives here: the city never
 * carries its own votes (its baseline must equal the sum of its zone keys),
 * and it never enters the catalog or the election artifact, so no aggregate
 * consumer that iterates either can double count it.
 */
describe('salvador city aggregate', () => {
  it('derives exactly the 19 Salvador zone slugs from the catalog', () => {
    expect(salvadorCity.zoneSlugs).toHaveLength(19)
    expect(salvadorCity.tseZones).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ])
    for (const slug of salvadorCity.zoneSlugs) {
      expect(slug).toMatch(/^salvador-ze-\d+$/)
      expect(municipalityCatalog.some((entry) => entry.slug === slug)).toBe(true)
    }
  })

  it('never becomes a catalog unit or an artifact key (guardrail estrutural)', () => {
    expect(municipalityCatalog.some((entry) => entry.slug === salvadorCity.slug)).toBe(false)
    expect(municipalityCatalog).toHaveLength(435)
    expect(federalBaselineMunicipalitySlugs().includes(salvadorCity.slug)).toBe(false)
  })

  it('statewide totals are unchanged by the city (it is computed, never stored)', () => {
    let sumOverCatalog = 0
    for (const slug of federalBaselineMunicipalitySlugs()) {
      sumOverCatalog += getMunicipalityFederalBaseline(slug).votesByYear['2022'] ?? 0
    }
    expect(getStatewideFederalTotals(2022).ownVotes).toBe(sumOverCatalog)
    expect(cityFederalBaseline().votesByYear['2022']).toBeGreaterThan(0)
    expect(cityFederalBaseline().votesByYear['2022']).toBeLessThan(sumOverCatalog)
  })

  it('city baseline equals the sum of its zone baselines for every year (no new votes)', () => {
    const city = cityFederalBaseline()
    const zoneKeys = salvadorCity.zoneSlugs

    for (const year of ['2014', '2018', '2022']) {
      const summedVotes = zoneKeys.reduce(
        (total, slug) => total + (getMunicipalityFederalBaseline(slug).votesByYear[year] ?? 0),
        0,
      )
      const summedValid = zoneKeys.reduce(
        (total, slug) => total + (getMunicipalityFederalBaseline(slug).validVotesByYear[year] ?? 0),
        0,
      )
      const summedCampo = zoneKeys.reduce(
        (total, slug) =>
          total + (getMunicipalityFederalBaseline(slug).campoFederalVotesByYear[year] ?? 0),
        0,
      )
      expect(city.votesByYear[year]).toBe(summedVotes)
      expect(city.validVotesByYear[year]).toBe(summedValid)
      expect(city.campoFederalVotesByYear[year]).toBe(summedCampo)
    }

    const summedTally = zoneKeys.reduce(
      (total, slug) => {
        const tally = getMunicipalityFederalBaseline(slug).federalTallyByYear['2022']
        return {
          comparecimento: total.comparecimento + (tally?.comparecimento ?? 0),
          votosValidos: total.votosValidos + (tally?.votosValidos ?? 0),
          votosBranco: total.votosBranco + (tally?.votosBranco ?? 0),
          votosNulo: total.votosNulo + (tally?.votosNulo ?? 0),
        }
      },
      { comparecimento: 0, votosValidos: 0, votosBranco: 0, votosNulo: 0 },
    )
    expect(city.federalTallyByYear['2022']).toEqual(summedTally)
  })

  it('carries one whole-city competitive placement ("12º de 663")', () => {
    const placement = cityCompetitiveRank(ELECTION_YEAR_2022)
    expect(placement).not.toBeNull()
    if (!placement) return
    expect(placement.rank).toBeGreaterThanOrEqual(1)
    expect(placement.candidates).toBeGreaterThanOrEqual(placement.rank)

    const entry = cityVoteRankEntry(ELECTION_YEAR_2022)
    expect(entry).not.toBeNull()
    expect(entry?.votes).toBe(cityFederalBaseline().votesByYear['2022'])
    expect(entry?.rank).toBe(placement.rank)
    expect(entry?.totalUnits).toBe(placement.candidates)
    expect(entry?.share).toBeGreaterThan(0)
    expect(entry?.share).toBeLessThan(1)
  })

  it('returns no rank entry for a year without placement (never a fabricated last place)', () => {
    expect(cityVoteRankEntry(1999)).toBeNull()
  })

  it('isCitySlug only recognizes the city slug', () => {
    expect(isCitySlug('salvador')).toBe(true)
    expect(isCitySlug('salvador-ze-1')).toBe(false)
    expect(isCitySlug('feira-de-santana')).toBe(false)
  })
})
