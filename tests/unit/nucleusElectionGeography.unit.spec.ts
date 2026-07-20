// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { citiesForTerritory } from '@/lib/bahiaTerritories'
import { tseCityCodeForMunicipality } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import { resolveNucleusElectionGeography } from '@/utilities/nucleusElectionGeography'

describe('resolveNucleusElectionGeography', () => {
  it('intersects nucleus tseZones with official city zones', () => {
    const salvadorZones = tseZonesForCity('Salvador')
    expect(salvadorZones.length).toBeGreaterThan(1)
    const firstZone = salvadorZones[0]!
    const secondZone = salvadorZones[1]!

    const geography = resolveNucleusElectionGeography({
      cities: ['Salvador'],
      regions: [],
      tseZones: [firstZone, 999],
    })

    expect(geography).not.toBeNull()
    expect([...geography!.zonesByCity.keys()]).toEqual(['Salvador'])
    expect(geography?.zonesByCity.get('Salvador')).toEqual([firstZone])
    expect(geography?.cityZonePairs).toEqual([
      { cityName: 'Salvador', cityCode: tseCityCodeForMunicipality('Salvador'), zoneNumber: firstZone },
    ])
    expect(geography?.zonesByCity.get('Salvador')).not.toContain(secondZone)
  })

  it('falls back to all city zones when typed tseZones lie outside the city', () => {
    const salvadorZones = [...tseZonesForCity('Salvador')]
    const geography = resolveNucleusElectionGeography({
      cities: ['Salvador'],
      regions: [],
      tseZones: [998, 999],
    })

    expect(geography?.zonesByCity.get('Salvador')).toEqual(salvadorZones)
  })

  it('expands territory regions when cities are empty', () => {
    const cities = citiesForTerritory('Velho Chico')
    const geography = resolveNucleusElectionGeography({
      cities: [],
      regions: ['Velho Chico'],
      tseZones: [],
    })

    expect(geography).not.toBeNull()
    expect([...geography!.zonesByCity.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(
      [...cities].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )
    expect(geography?.zonesByCity.get('Bom Jesus da Lapa')).toEqual([
      ...tseZonesForCity('Bom Jesus da Lapa'),
    ])
  })

  it('returns null without cities or regions', () => {
    expect(
      resolveNucleusElectionGeography({
        cities: [],
        regions: [],
        tseZones: [1],
      }),
    ).toBeNull()
  })

  it('returns null when cities have no TSE city code mapping', () => {
    expect(
      resolveNucleusElectionGeography({
        cities: ['Município inexistente'],
        regions: [],
        tseZones: [],
      }),
    ).toBeNull()
  })
})
