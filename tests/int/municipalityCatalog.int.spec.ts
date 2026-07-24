// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import { bahiaMunicipalities, territoryForCity } from '@/lib/bahiaTerritories'
import { bahiaTseCityCodes } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import {
  getMunicipalityCatalogEntry,
  isMunicipalitySlug,
  municipalityCatalog,
  municipalityCatalogEntriesForCity,
  ZONE_MUNICIPALITY_CITIES,
} from '@/lib/municipalityCatalog'

type Snapshot = {
  municipalityCount: number
  zoneMunicipalityCities: string[]
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
  readFileSync(new URL('../fixtures/municipality-catalog.snapshot.json', import.meta.url), 'utf8'),
) as Snapshot

describe('Municipality catalog (435 predefined territories)', () => {
  it('has 435 municipalities: 416 whole municipalities + 19 Salvador zones (Camaçari is whole)', () => {
    expect(municipalityCatalog).toHaveLength(435)
    expect(municipalityCatalog.filter((entry) => entry.kind === 'municipio')).toHaveLength(416)

    const zoneEntries = municipalityCatalog.filter((entry) => entry.kind === 'zona')
    expect(zoneEntries).toHaveLength(19)
    expect(zoneEntries.filter((entry) => entry.city === 'Salvador')).toHaveLength(19)
    expect(municipalityCatalogEntriesForCity('Camaçari')).toHaveLength(1)
    expect(municipalityCatalogEntriesForCity('Camaçari')[0]?.kind).toBe('municipio')
    expect(ZONE_MUNICIPALITY_CITIES).toEqual(['Salvador'])
  })

  it('has unique, stable slugs and names', () => {
    expect(new Set(municipalityCatalog.map((entry) => entry.slug)).size).toBe(435)
    expect(new Set(municipalityCatalog.map((entry) => entry.name)).size).toBe(435)

    for (const entry of municipalityCatalog) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('covers every Bahia municipality exactly once (Salvador via zones)', () => {
    const municipalityEntries = municipalityCatalog.filter((entry) => entry.kind === 'municipio')
    const coveredAsMunicipality = new Set(municipalityEntries.map((entry) => entry.city))

    for (const city of bahiaMunicipalities) {
      if (ZONE_MUNICIPALITY_CITIES.includes(city)) {
        expect(coveredAsMunicipality.has(city), city).toBe(false)
        const zoneEntries = municipalityCatalogEntriesForCity(city)
        expect(zoneEntries.length, city).toBeGreaterThan(1)
        expect(new Set(zoneEntries.map((entry) => entry.zoneNumber)).size).toBe(zoneEntries.length)
        expect(
          [...zoneEntries.map((entry) => entry.zoneNumber)].sort((a, b) => (a ?? 0) - (b ?? 0)),
        ).toEqual([...tseZonesForCity(city)].sort((a, b) => a - b))
      } else {
        expect(coveredAsMunicipality.has(city), city).toBe(true)
        expect(municipalityCatalogEntriesForCity(city)).toHaveLength(1)
      }
    }
  })

  it('carries consistent region, codes and zones for every entry', () => {
    for (const entry of municipalityCatalog) {
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
    expect(snapshot.municipalityCount).toBe(435)
    expect(snapshot.zoneMunicipalityCities).toEqual([...ZONE_MUNICIPALITY_CITIES])

    const derived = municipalityCatalog.map(
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
    expect(getMunicipalityCatalogEntry('feira-de-santana')?.city).toBe('Feira de Santana')
    expect(getMunicipalityCatalogEntry('salvador-ze-1')?.zoneNumber).toBe(1)
    expect(getMunicipalityCatalogEntry('camacari')?.kind).toBe('municipio')
    expect(getMunicipalityCatalogEntry('camacari-ze-170')).toBeUndefined()
    expect(getMunicipalityCatalogEntry('salvador')).toBeUndefined()
    expect(isMunicipalitySlug('salvador-ze-19')).toBe(true)
    expect(isMunicipalitySlug('salvador-ze-20')).toBe(false)
  })

  it('cuts shared/leaky zones at the municipal boundary (no overlap between municipalities)', () => {
    for (const city of [
      'Itaparica',
      'Vera Cruz',
      'São Sebastião do Passé',
      'Mata de São João',
      'Pojuca',
    ]) {
      const entries = municipalityCatalogEntriesForCity(city)
      expect(entries).toHaveLength(1)
      expect(entries[0]?.kind).toBe('municipio')
    }

    const pairs = new Set<string>()
    for (const entry of municipalityCatalog) {
      for (const zone of entry.tseZones) {
        const key = `${entry.tseCityCode}:${zone}`
        expect(pairs.has(key), key).toBe(false)
        pairs.add(key)
      }
    }
  })
})
