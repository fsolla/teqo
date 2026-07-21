// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import { bahiaMunicipalities, territoryForCity } from '@/lib/bahiaTerritories'
import { bahiaTseCityCodes } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import {
  getPlazaCatalogEntry,
  isPlazaSlug,
  plazaCatalog,
  plazaCatalogEntriesForCity,
  ZONE_PLAZA_CITIES,
} from '@/lib/plazaCatalog'

type Snapshot = {
  plazaCount: number
  zonePlazaCities: string[]
  identitySha256: string
  entries: Array<{
    slug: string
    name: string
    kind: 'municipio' | 'zona'
    city: string
    region: string
    ibgeCode: string
    tseCityCode: string
    zoneNumber?: number
    tseZones: number[]
  }>
}

const snapshot = JSON.parse(
  readFileSync(new URL('../fixtures/plaza-catalog.snapshot.json', import.meta.url), 'utf8'),
) as Snapshot

describe('Praça catalog (436 predefined territories)', () => {
  it('has 436 plazas: 415 municipality + 19 Salvador zones + 2 Camaçari zones', () => {
    expect(plazaCatalog).toHaveLength(436)
    expect(plazaCatalog.filter((entry) => entry.kind === 'municipio')).toHaveLength(415)

    const zoneEntries = plazaCatalog.filter((entry) => entry.kind === 'zona')
    expect(zoneEntries).toHaveLength(21)
    expect(zoneEntries.filter((entry) => entry.city === 'Salvador')).toHaveLength(19)
    expect(zoneEntries.filter((entry) => entry.city === 'Camaçari')).toHaveLength(2)
    expect(ZONE_PLAZA_CITIES).toEqual(['Salvador', 'Camaçari'])
  })

  it('has unique, stable slugs and names', () => {
    expect(new Set(plazaCatalog.map((entry) => entry.slug)).size).toBe(436)
    expect(new Set(plazaCatalog.map((entry) => entry.name)).size).toBe(436)

    for (const entry of plazaCatalog) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('covers every Bahia municipality exactly once (zone cities via their zones)', () => {
    const municipalityEntries = plazaCatalog.filter((entry) => entry.kind === 'municipio')
    const coveredAsMunicipality = new Set(municipalityEntries.map((entry) => entry.city))

    for (const city of bahiaMunicipalities) {
      if (ZONE_PLAZA_CITIES.includes(city)) {
        expect(coveredAsMunicipality.has(city), city).toBe(false)
        const zoneEntries = plazaCatalogEntriesForCity(city)
        expect(zoneEntries.length, city).toBeGreaterThan(1)
        expect(new Set(zoneEntries.map((entry) => entry.zoneNumber)).size).toBe(zoneEntries.length)
        expect(
          [...zoneEntries.map((entry) => entry.zoneNumber)].sort((a, b) => (a ?? 0) - (b ?? 0)),
        ).toEqual([...tseZonesForCity(city)].sort((a, b) => a - b))
      } else {
        expect(coveredAsMunicipality.has(city), city).toBe(true)
        expect(plazaCatalogEntriesForCity(city)).toHaveLength(1)
      }
    }
  })

  it('carries consistent region, codes and zones for every entry', () => {
    for (const entry of plazaCatalog) {
      expect(entry.region, entry.slug).toBe(territoryForCity(entry.city))
      expect(entry.ibgeCode, entry.slug).toBe(bahiaMunicipalityCodes[entry.city])
      expect(entry.tseCityCode, entry.slug).toBe(bahiaTseCityCodes[entry.city])
      expect(entry.tseZones.length, entry.slug).toBeGreaterThan(0)

      const officialZones = new Set(tseZonesForCity(entry.city))
      for (const zone of entry.tseZones) {
        expect(officialZones.has(zone), `${entry.slug} zone ${zone}`).toBe(true)
      }

      if (entry.kind === 'zona') {
        expect(entry.zoneNumber).toBeDefined()
        expect(entry.tseZones).toEqual([entry.zoneNumber])
        expect(entry.name).toBe(`${entry.city} — ZE ${entry.zoneNumber}`)
      } else {
        expect(entry.zoneNumber).toBeUndefined()
        expect(entry.name).toBe(entry.city)
        expect([...entry.tseZones]).toEqual([...tseZonesForCity(entry.city)].sort((a, b) => a - b))
      }
    }
  })

  it('matches the frozen identity snapshot (slugs/names are public URLs + seed identity)', () => {
    expect(snapshot.plazaCount).toBe(436)
    expect(snapshot.zonePlazaCities).toEqual([...ZONE_PLAZA_CITIES])

    const derived = plazaCatalog.map(
      ({ slug, name, kind, city, region, ibgeCode, tseCityCode, zoneNumber, tseZones }) => ({
        slug,
        name,
        kind,
        city,
        region,
        ibgeCode,
        tseCityCode,
        ...(zoneNumber === undefined ? {} : { zoneNumber }),
        tseZones: [...tseZones],
      }),
    )
    expect(derived).toEqual(snapshot.entries)

    const rows = derived
      .map(
        (entry) =>
          `P\t${entry.slug}\t${entry.name}\t${entry.kind}\t${entry.city}\t${entry.zoneNumber ?? ''}\n`,
      )
      .join('')
    expect(createHash('sha256').update(rows).digest('hex')).toBe(snapshot.identitySha256)
  })

  it('supports slug lookups', () => {
    expect(getPlazaCatalogEntry('feira-de-santana')?.city).toBe('Feira de Santana')
    expect(getPlazaCatalogEntry('salvador-ze-1')?.zoneNumber).toBe(1)
    expect(getPlazaCatalogEntry('camacari-ze-170')?.kind).toBe('zona')
    expect(getPlazaCatalogEntry('salvador')).toBeUndefined()
    expect(isPlazaSlug('salvador-ze-19')).toBe(true)
    expect(isPlazaSlug('salvador-ze-20')).toBe(false)
  })

  it('cuts shared/leaky zones at the municipal boundary (no overlap between plazas)', () => {
    // ZE 141 (Itaparica + Vera Cruz), 162, 128, 185, 200 stay municipality plazas.
    for (const city of [
      'Itaparica',
      'Vera Cruz',
      'São Sebastião do Passé',
      'Mata de São João',
      'Pojuca',
    ]) {
      const entries = plazaCatalogEntriesForCity(city)
      expect(entries).toHaveLength(1)
      expect(entries[0]?.kind).toBe('municipio')
    }

    // Every (city × zone) pair belongs to exactly one plaza.
    const pairs = new Set<string>()
    for (const entry of plazaCatalog) {
      for (const zone of entry.tseZones) {
        const key = `${entry.tseCityCode}:${zone}`
        expect(pairs.has(key), key).toBe(false)
        pairs.add(key)
      }
    }
  })
})
