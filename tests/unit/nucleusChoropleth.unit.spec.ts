import { describe, expect, it } from 'vitest'

import {
  buildNucleusChoroplethBundle,
  codareasForCities,
  territoryCodesForNucleus,
} from '@/utilities/nucleusChoropleth'

describe('nucleusChoropleth', () => {
  it('maps canonical city names to IBGE codarea', () => {
    expect(codareasForCities(['Salvador', 'Feira de Santana'])).toEqual(['2927408', '2910800'])
  })

  it('splits confirmed estimate equally across multi-city nuclei', () => {
    const bundle = buildNucleusChoroplethBundle([
      {
        cities: ['Salvador', 'Feira de Santana'],
        regions: [],
        tseZones: [],
        confirmedVoteEstimate: 1000,
      },
    ])

    expect(bundle.municipality.nucleusCount['2927408']).toBe(1)
    expect(bundle.municipality.nucleusCount['2910800']).toBe(1)
    expect(bundle.municipality.confirmedEstimate['2927408']).toBe(500)
    expect(bundle.municipality.confirmedEstimate['2910800']).toBe(500)
  })

  it('does not double-count baseline votes for the same city in multiple nuclei', () => {
    const baseline = new Map([
      ['Salvador', 400_000],
      ['Feira de Santana', 50_000],
    ])

    const bundle = buildNucleusChoroplethBundle(
      [
        {
          cities: ['Salvador'],
          regions: [],
          tseZones: [],
          confirmedVoteEstimate: 1000,
        },
        {
          cities: ['Salvador', 'Feira de Santana'],
          regions: [],
          tseZones: [],
          confirmedVoteEstimate: 2000,
        },
      ],
      baseline,
    )

    expect(bundle.municipality.baseline2022Votes['2927408']).toBe(400_000)
    expect(bundle.municipality.baseline2022Votes['2910800']).toBe(50_000)
  })

  it('resolves territory codes from regions when present', () => {
    expect(
      territoryCodesForNucleus({
        cities: [],
        regions: ['Metropolitano de Salvador'],
      }),
    ).toEqual(['26'])
  })
})
