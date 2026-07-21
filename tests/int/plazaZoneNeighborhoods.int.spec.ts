// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { plazaCatalog } from '@/lib/plazaCatalog'
import {
  plazaZoneNeighborhoodEntryForSlug,
  plazaZoneNeighborhoodSourceLabel,
  plazaZoneNeighborhoods,
} from '@/lib/plazaZoneNeighborhoods'

type OfficialEvidence = {
  zoneCount: number
  assignments: Array<{
    plazaSlug: string
    city: 'Salvador' | 'Camaçari'
    zoneNumber: number
    source: 'tre-ra-02-2017' | 'tre-voting-locations-curated'
    neighborhoods: string[]
  }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(new URL('../fixtures/plaza-zone-neighborhoods.official.json', import.meta.url), 'utf8'),
) as OfficialEvidence

const canonicalEvidenceRows = (assignments: OfficialEvidence['assignments']): string =>
  [...assignments]
    .sort((left, right) => left.plazaSlug.localeCompare(right.plazaSlug, 'pt-BR'))
    .map(
      ({ plazaSlug, city, zoneNumber, neighborhoods }) =>
        `${plazaSlug}\t${city}\t${zoneNumber}\t${[...neighborhoods]
          .sort((left, right) => left.localeCompare(right, 'pt-BR'))
          .join('|')}\n`,
    )
    .join('')

describe('Praça-zona neighborhood catalog (Salvador + Camaçari)', () => {
  const zonePlazas = plazaCatalog.filter((entry) => entry.kind === 'zona')

  it('covers every zona Praça with a non-empty neighborhood list', () => {
    expect(plazaZoneNeighborhoods).toHaveLength(zonePlazas.length)
    expect(new Set(plazaZoneNeighborhoods.map((entry) => entry.plazaSlug)).size).toBe(
      zonePlazas.length,
    )

    for (const plaza of zonePlazas) {
      const record = plazaZoneNeighborhoodEntryForSlug(plaza.slug)
      expect(record, plaza.slug).toBeDefined()
      expect(record?.city).toBe(plaza.city)
      expect(record?.zoneNumber).toBe(plaza.zoneNumber)
      expect(record?.neighborhoods.length, plaza.slug).toBeGreaterThan(0)
    }
  })

  it('keeps Salvador neighborhoods exclusive across zones (Camaçari is curated — no cross-zone exclusivity test)', () => {
    const seen = new Map<string, string>()

    for (const record of plazaZoneNeighborhoods.filter((entry) => entry.city === 'Salvador')) {
      for (const neighborhood of record.neighborhoods) {
        const previous = seen.get(neighborhood)
        expect(previous, `${neighborhood} in ZE ${record.zoneNumber}`).toBeUndefined()
        seen.set(neighborhood, record.plazaSlug)
      }
    }
  })

  it('matches the independently transcribed official evidence fixture', () => {
    expect(officialEvidence.zoneCount).toBe(zonePlazas.length)
    expect(
      officialEvidence.assignments.map(
        ({ plazaSlug, city, zoneNumber, source, neighborhoods }) => ({
          plazaSlug,
          city,
          zoneNumber,
          source,
          neighborhoods,
        }),
      ),
    ).toEqual(
      plazaZoneNeighborhoods.map(({ plazaSlug, city, zoneNumber, source, neighborhoods }) => ({
        plazaSlug,
        city,
        zoneNumber,
        source,
        neighborhoods: [...neighborhoods],
      })),
    )
  })

  it('matches every assignment by a fixed evidence checksum', () => {
    const digest = createHash('sha256')
      .update(
        canonicalEvidenceRows(
          plazaZoneNeighborhoods.map(
            ({ plazaSlug, city, zoneNumber, source, neighborhoods }) => ({
              plazaSlug,
              city,
              zoneNumber,
              source,
              neighborhoods: [...neighborhoods],
            }),
          ),
        ),
      )
      .digest('hex')
    expect(digest).toBe(officialEvidence.evidenceSha256)
  })

  it('exposes lookup helpers for zona slugs only', () => {
    expect(plazaZoneNeighborhoodEntryForSlug('salvador-ze-3')?.neighborhoods).toContain(
      'Santa Mônica',
    )
    expect(plazaZoneNeighborhoodEntryForSlug('camacari-ze-171')?.neighborhoods).toContain(
      'Arembepe',
    )
    expect(plazaZoneNeighborhoodEntryForSlug('feira-de-santana')).toBeUndefined()
    expect(plazaZoneNeighborhoodEntryForSlug('salvador-ze-1')?.source).toBe('tre-ra-02-2017')
    expect(plazaZoneNeighborhoodSourceLabel('tre-ra-02-2017')).toMatch(/Resolução Administrativa/)
    expect(plazaZoneNeighborhoodSourceLabel('tre-voting-locations-curated')).toMatch(/aproximada/)
  })
})
