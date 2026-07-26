// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  municipalityZoneNeighborhoodEntryForSlug,
  municipalityZoneNeighborhoodSourceLabel,
  municipalityZoneNeighborhoods,
} from '@/lib/municipalityZoneNeighborhoods'

type OfficialEvidence = {
  zoneCount: number
  assignments: Array<{
    municipalitySlug: string
    city: 'Salvador' | 'Camaçari'
    zoneNumber: number
    source: 'tre-ra-02-2017' | 'tre-voting-locations-curated'
    neighborhoods: string[]
  }>
  evidenceSha256: string
}

const officialEvidence = JSON.parse(
  readFileSync(
    new URL('../fixtures/municipality-zone-neighborhoods.official.json', import.meta.url),
    'utf8',
  ),
) as OfficialEvidence

const canonicalEvidenceRows = (assignments: OfficialEvidence['assignments']): string =>
  [...assignments]
    .sort((left, right) => left.municipalitySlug.localeCompare(right.municipalitySlug, 'pt-BR'))
    .map(
      ({ municipalitySlug, city, zoneNumber, neighborhoods }) =>
        `${municipalitySlug}\t${city}\t${zoneNumber}\t${[...neighborhoods]
          .sort((left, right) => left.localeCompare(right, 'pt-BR'))
          .join('|')}\n`,
    )
    .join('')

describe('Municipality zone neighborhood catalog (Salvador only)', () => {
  const zoneMunicipalities = municipalityCatalog.filter((entry) => entry.kind === 'zona')

  it('covers every zone municipality with a non-empty neighborhood list', () => {
    expect(municipalityZoneNeighborhoods).toHaveLength(zoneMunicipalities.length)
    expect(new Set(municipalityZoneNeighborhoods.map((entry) => entry.municipalitySlug)).size).toBe(
      zoneMunicipalities.length,
    )

    for (const municipality of zoneMunicipalities) {
      const record = municipalityZoneNeighborhoodEntryForSlug(municipality.slug)
      expect(record, municipality.slug).toBeDefined()
      expect(record?.city).toBe(municipality.city)
      expect(record?.zoneNumber).toBe(municipality.zoneNumber)
      expect(record?.neighborhoods.length, municipality.slug).toBeGreaterThan(0)
    }
  })

  it('keeps Salvador neighborhoods exclusive across zones', () => {
    const seen = new Map<string, string>()

    for (const record of municipalityZoneNeighborhoods.filter(
      (entry) => entry.city === 'Salvador',
    )) {
      for (const neighborhood of record.neighborhoods) {
        const previous = seen.get(neighborhood)
        expect(previous, `${neighborhood} in ZE ${record.zoneNumber}`).toBeUndefined()
        seen.set(neighborhood, record.municipalitySlug)
      }
    }
  })

  it('matches the independently transcribed official evidence fixture', () => {
    expect(officialEvidence.zoneCount).toBe(zoneMunicipalities.length)
    expect(
      officialEvidence.assignments.map(
        ({ municipalitySlug, city, zoneNumber, source, neighborhoods }) => ({
          municipalitySlug,
          city,
          zoneNumber,
          source,
          neighborhoods,
        }),
      ),
    ).toEqual(
      municipalityZoneNeighborhoods.map(
        ({ municipalitySlug, city, zoneNumber, source, neighborhoods }) => ({
          municipalitySlug,
          city,
          zoneNumber,
          source,
          neighborhoods: [...neighborhoods],
        }),
      ),
    )
  })

  it('matches every assignment by a fixed evidence checksum', () => {
    const digest = createHash('sha256')
      .update(
        canonicalEvidenceRows(
          municipalityZoneNeighborhoods.map(
            ({ municipalitySlug, city, zoneNumber, source, neighborhoods }) => ({
              municipalitySlug,
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
    expect(municipalityZoneNeighborhoodEntryForSlug('salvador-ze-3')?.neighborhoods).toContain(
      'Santa Mônica',
    )
    expect(municipalityZoneNeighborhoodEntryForSlug('camacari')).toBeUndefined()
    expect(municipalityZoneNeighborhoodEntryForSlug('feira-de-santana')).toBeUndefined()
    expect(municipalityZoneNeighborhoodEntryForSlug('salvador-ze-1')?.source).toBe('tre-ra-02-2017')
    expect(municipalityZoneNeighborhoodSourceLabel('tre-ra-02-2017')).toMatch(
      /Resolução Administrativa/,
    )
  })
})
