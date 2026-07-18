// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { citiesForTerritory } from '@/lib/bahiaTerritories'
import { tseZonesForCity, tseZonesForTerritory } from '@/lib/bahiaTseZones'
import { MAX_NUCLEUS_CITIES } from '@/lib/schemas/nucleus'
import { buildTerritorySuggestions } from '@/lib/territorySuggestions'

describe('buildTerritorySuggestions', () => {
  it('suggests missing city and territory zones for the Vale do Jiquiriçá example', () => {
    const result = buildTerritorySuggestions({
      cities: ['Itiruçu'],
      regions: ['Vale do Jiquiriçá'],
      tseZones: [],
    })

    expect(result.zoneSuggestions).toEqual(
      expect.arrayContaining([
        {
          kind: 'city',
          label: 'Itiruçu',
          zonesToAdd: [...tseZonesForCity('Itiruçu')],
        },
        {
          kind: 'territory',
          label: 'Vale do Jiquiriçá',
          zonesToAdd: [...tseZonesForTerritory('Vale do Jiquiriçá')],
        },
      ]),
    )
    expect(result.zoneSuggestions.map((s) => s.label)).toEqual(
      [...result.zoneSuggestions.map((s) => s.label)].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )

    expect(result.citySuggestions.map((s) => s.city)).toContain('Maracás')
    expect(result.citySuggestions.find((s) => s.city === 'Maracás')?.kind).toBe('sibling')
    expect(result.citySuggestions.map((s) => s.city)).not.toContain('Itiruçu')
  })

  it('hides city zone chip when that city set is complete but keeps territory chip', () => {
    const itirucuZones = [...tseZonesForCity('Itiruçu')]
    const result = buildTerritorySuggestions({
      cities: ['Itiruçu'],
      regions: ['Vale do Jiquiriçá'],
      tseZones: itirucuZones,
    })

    expect(result.zoneSuggestions.find((s) => s.kind === 'city' && s.label === 'Itiruçu')).toBeUndefined()
    const territoryChip = result.zoneSuggestions.find(
      (s) => s.kind === 'territory' && s.label === 'Vale do Jiquiriçá',
    )
    expect(territoryChip).toBeDefined()
    expect(territoryChip?.zonesToAdd.length).toBeGreaterThan(0)
    for (const zone of itirucuZones) {
      expect(territoryChip?.zonesToAdd).not.toContain(zone)
    }
  })

  it('returns no zone chips when the territory union is already present', () => {
    const valeZones = [...tseZonesForTerritory('Vale do Jiquiriçá')]
    const valeCities = [...citiesForTerritory('Vale do Jiquiriçá')]
    const result = buildTerritorySuggestions({
      cities: valeCities,
      regions: ['Vale do Jiquiriçá'],
      tseZones: valeZones,
    })

    expect(result.zoneSuggestions).toEqual([])
    // Shared zones may still suggest municipalities outside the TI — that is expected.
    expect(result.citySuggestions.every((s) => !valeCities.includes(s.city))).toBe(true)
  })

  it('suggests municipalities from a selected shared zone and dedupes with siblings', () => {
    const result = buildTerritorySuggestions({
      cities: ['Itiruçu'],
      regions: ['Vale do Jiquiriçá'],
      tseZones: [37],
    })

    const maracas = result.citySuggestions.filter((s) => s.city === 'Maracás')
    expect(maracas).toHaveLength(1)
    expect(maracas[0]?.kind).toBe('sibling')
  })

  it('suggests municipalities from zone alone when no region is selected', () => {
    const result = buildTerritorySuggestions({
      cities: [],
      regions: [],
      tseZones: [37],
    })

    expect(result.citySuggestions.map((s) => s.city)).toEqual(
      expect.arrayContaining(['Itiruçu', 'Maracás']),
    )
    expect(result.citySuggestions.every((s) => s.kind === 'zone')).toBe(true)
  })

  it('suppresses city suggestions when the municipality quota is reached', () => {
    const cities = [
      ...citiesForTerritory('Vale do Jiquiriçá'),
      ...citiesForTerritory('Metropolitano de Salvador'),
    ].slice(0, MAX_NUCLEUS_CITIES)
    expect(cities).toHaveLength(MAX_NUCLEUS_CITIES)

    const result = buildTerritorySuggestions({
      cities,
      regions: ['Vale do Jiquiriçá', 'Metropolitano de Salvador'],
      tseZones: [1],
    })

    expect(result.citySuggestions).toEqual([])
  })
})
