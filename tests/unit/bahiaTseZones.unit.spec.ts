// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  bahiaMunicipalities,
  citiesForTerritory,
  isBahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'
import {
  bahiaMunicipalityTseZones,
  citiesForTseZone,
  tseZonesForCity,
  tseZonesForTerritory,
} from '@/lib/bahiaTseZones'

type OfficialEvidence = {
  municipalityCount: number
  assignments: Array<{ municipality: string; zones: number[] }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(new URL('../fixtures/bahia-tse-zones.official.json', import.meta.url), 'utf8'),
) as OfficialEvidence

describe('Bahia municipality ↔ TSE zone mapping', () => {
  it('covers all 417 Bahia municipalities with zones in 1–999', () => {
    expect(Object.keys(bahiaMunicipalityTseZones)).toHaveLength(417)
    expect(bahiaMunicipalities).toHaveLength(417)

    for (const city of bahiaMunicipalities) {
      const zones = bahiaMunicipalityTseZones[city]
      expect(zones, city).toBeDefined()
      expect(zones.length, city).toBeGreaterThan(0)
      for (const zone of zones) {
        expect(zone).toBeGreaterThanOrEqual(1)
        expect(zone).toBeLessThanOrEqual(999)
      }
      expect(zones).toEqual([...zones].sort((left, right) => left - right))
      expect(new Set(zones).size).toBe(zones.length)
    }
  })

  it('matches the independently downloaded official municipality↔zone evidence', () => {
    expect(officialEvidence.municipalityCount).toBe(417)
    expect(
      officialEvidence.assignments.map(({ municipality, zones }) => ({ municipality, zones })),
    ).toEqual(
      Object.entries(bahiaMunicipalityTseZones)
        .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
        .map(([municipality, zones]) => ({ municipality, zones: [...zones] })),
    )
  })

  it('matches every official assignment by a fixed evidence checksum', () => {
    const assignmentRows = Object.entries(bahiaMunicipalityTseZones)
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([municipality, zones]) => `M\t${municipality}\t${zones.join(',')}\n`)
      .join('')

    expect(createHash('sha256').update(assignmentRows).digest('hex')).toBe(
      officialEvidence.evidenceSha256,
    )
  })

  it('supports bidirectional lookups and territory unions', () => {
    expect(tseZonesForCity('Salvador')).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ])
    expect(tseZonesForCity('Itiruçu')).toEqual([37])
    expect(tseZonesForCity('Maracás')).toEqual([37])
    expect(tseZonesForCity('Município inexistente')).toEqual([])
    expect(tseZonesForCity('')).toEqual([])

    expect(tseZonesForCity('Salvador').includes(1)).toBe(true)
    expect(tseZonesForCity('Salvador').includes(999)).toBe(false)
    expect(tseZonesForCity('Município inexistente').includes(1)).toBe(false)

    expect(citiesForTseZone(37)).toEqual(expect.arrayContaining(['Itiruçu', 'Maracás']))
    expect([...citiesForTseZone(37)]).toEqual(
      [...citiesForTseZone(37)].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    )
    expect(citiesForTseZone(9999)).toEqual([])

    expect(isBahiaIdentityTerritory('Vale do Jiquiriçá')).toBe(true)
    const valeZones = tseZonesForTerritory('Vale do Jiquiriçá')
    const expectedUnion = [
      ...new Set(
        citiesForTerritory('Vale do Jiquiriçá').flatMap((city) => [...tseZonesForCity(city)]),
      ),
    ].sort((left, right) => left - right)
    expect(valeZones).toEqual(expectedUnion)
    expect(valeZones.includes(37)).toBe(true)
  })
})
