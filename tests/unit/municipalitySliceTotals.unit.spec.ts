import { describe, expect, it } from 'vitest'

import {
  federalBaselineMunicipalitySlugs,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '@/lib/bahiaElectionAggregates'
import { computeMunicipalitySliceTotals } from '@/lib/municipalitySliceTotals'
import { computeVoteRankByYear, DEFAULT_VOTE_RANK_YEAR } from '@/lib/municipalityVoteRank'
import { SALVADOR_CITY_SLUG, salvadorCity } from '@/lib/salvadorCity'
import { cityFederalBaseline } from '@/utilities/municipality/salvadorCityAggregates'

const zeroEstimates = { pessimistic: null, central: null, optimistic: null }

describe('computeMunicipalitySliceTotals', () => {
  it('returns null for an empty slice — no invented totals', () => {
    expect(computeMunicipalitySliceTotals([])).toBeNull()
  })

  it('sums 2022 over the given rows and ignores unknown slugs', () => {
    const ranks = computeVoteRankByYear(DEFAULT_VOTE_RANK_YEAR)
    const withVotes = federalBaselineMunicipalitySlugs().filter(
      (slug) => (ranks.get(slug)?.votes ?? 0) > 0,
    )
    const first = withVotes[0]!
    const second = withVotes[1]!

    const totals = computeMunicipalitySliceTotals([
      { slug: first },
      { slug: second },
      { slug: 'nao-existe' },
    ])

    expect(totals).not.toBeNull()
    expect(totals!.rowCount).toBe(3)
    expect(totals!.votes2022).toBe(
      getMunicipalityFederalBaseline(first).votesByYear['2022']! +
        getMunicipalityFederalBaseline(second).votesByYear['2022']!,
    )
  })

  it('sums the whole catalog (no city row) to the statewide own votes', () => {
    const totals = computeMunicipalitySliceTotals(
      federalBaselineMunicipalitySlugs().map((slug) => ({ slug })),
    )

    expect(totals!.rowCount).toBe(435)
    expect(totals!.votes2022).toBe(getStatewideFederalTotals(DEFAULT_VOTE_RANK_YEAR).ownVotes)
  })

  it('counts Salvador once: city plus its 19 ZE equals the city fold, never both', () => {
    const cityVotes = cityFederalBaseline().votesByYear['2022']!
    const cityAndZones = computeMunicipalitySliceTotals([
      { slug: SALVADOR_CITY_SLUG },
      ...salvadorCity.zoneSlugs.map((slug) => ({ slug })),
    ])
    const zonesOnly = computeMunicipalitySliceTotals(
      salvadorCity.zoneSlugs.map((slug) => ({ slug })),
    )

    expect(cityVotes).toBeGreaterThan(0)
    expect(cityAndZones!.votes2022).toBe(cityVotes)
    expect(zonesOnly!.votes2022).toBe(cityVotes)
  })

  it('still sums the zone expectations when the city folds their votes', () => {
    const totals = computeMunicipalitySliceTotals([
      { slug: SALVADOR_CITY_SLUG },
      { slug: salvadorCity.zoneSlugs[0]!, expectedVotes: { central: 5_000 } },
      {
        slug: salvadorCity.zoneSlugs[1]!,
        expectedVotes: { pessimistic: 1_000, optimistic: 9_000 },
      },
    ])

    expect(totals!.votes2022).toBe(cityFederalBaseline().votesByYear['2022']!)
    expect(totals!.expectedByScenario).toEqual({
      pessimistic: 1_000,
      central: 5_000,
      optimistic: 9_000,
    })
    expect(totals!.withEstimateCount).toBe(2)
  })

  it('keeps a scenario nobody filled null and counts rows with any estimate', () => {
    const totals = computeMunicipalitySliceTotals([
      { slug: 'a', expectedVotes: zeroEstimates },
      { slug: 'b', expectedVotes: { pessimistic: 100, central: 200, optimistic: null } },
      { slug: 'c', expectedVotes: { central: 50, optimistic: 0 } },
    ])

    expect(totals!.expectedByScenario).toEqual({
      pessimistic: 100,
      central: 250,
      optimistic: 0,
    })
    expect(totals!.withEstimateCount).toBe(2)
  })

  it('reports all scenarios null when no row has an estimate', () => {
    const totals = computeMunicipalitySliceTotals([
      { slug: 'a', expectedVotes: zeroEstimates },
      { slug: 'b' },
    ])

    expect(totals!.expectedByScenario).toEqual(zeroEstimates)
    expect(totals!.withEstimateCount).toBe(0)
  })
})
