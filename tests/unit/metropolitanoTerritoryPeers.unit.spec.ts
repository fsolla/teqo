import { describe, expect, it } from 'vitest'

import {
  METROPOLITANO_DEMAIS_SUB_ROW_LABEL,
  METROPOLITANO_REGION,
  METROPOLITANO_SALVADOR_SUB_ROW_LABEL,
  SALVADOR_CITY,
  catalogPeersForSlug,
  filterDemaisRmsSubgroup,
  filterSalvadorSubgroup,
  isSalvadorMetropolitanoSubRowLabel,
} from '@/lib/metropolitanoTerritoryPeers'
import { municipalityCatalog } from '@/lib/municipalityCatalog'

describe('metropolitanoTerritoryPeers', () => {
  it('Salvador zone peers are exactly the 19 Metropolitano Salvador entries', () => {
    const salvadorZe = municipalityCatalog.find(
      (row) =>
        row.region === METROPOLITANO_REGION && row.city === SALVADOR_CITY && row.kind === 'zona',
    )
    expect(salvadorZe).toBeDefined()

    const peers = catalogPeersForSlug(salvadorZe!.slug)
    expect(peers).toHaveLength(19)
    expect(
      peers.every((row) => row.city === SALVADOR_CITY && row.region === METROPOLITANO_REGION),
    ).toBe(true)
  })

  it('RMS peer outside Salvador excludes Salvador zones', () => {
    const rmsPeer = municipalityCatalog.find(
      (row) => row.region === METROPOLITANO_REGION && row.city !== SALVADOR_CITY,
    )
    expect(rmsPeer).toBeDefined()

    const peers = catalogPeersForSlug(rmsPeer!.slug)
    expect(peers.length).toBeGreaterThan(0)
    expect(
      peers.every((row) => row.region === METROPOLITANO_REGION && row.city !== SALVADOR_CITY),
    ).toBe(true)
    expect(peers.some((row) => row.city === SALVADOR_CITY)).toBe(false)
  })

  it('non-Metropolitano peers share the same identity territory', () => {
    const irece = municipalityCatalog.find((row) => row.region === 'Irecê')
    expect(irece).toBeDefined()

    const peers = catalogPeersForSlug(irece!.slug)
    expect(peers.length).toBeGreaterThan(1)
    expect(peers.every((row) => row.region === 'Irecê')).toBe(true)
  })

  it('sub-row filters match catalog Salvador vs demais RMS', () => {
    const salvadorSlugs = new Set(
      filterSalvadorSubgroup(municipalityCatalog).map((row) => row.slug),
    )
    const demaisSlugs = new Set(filterDemaisRmsSubgroup(municipalityCatalog).map((row) => row.slug))

    expect(salvadorSlugs.size).toBe(19)
    expect(demaisSlugs.size).toBeGreaterThan(0)
    for (const slug of salvadorSlugs) {
      expect(demaisSlugs.has(slug)).toBe(false)
    }
  })

  it('sub-row labels distinguish Salvador vs demais', () => {
    expect(isSalvadorMetropolitanoSubRowLabel(METROPOLITANO_SALVADOR_SUB_ROW_LABEL)).toBe(true)
    expect(isSalvadorMetropolitanoSubRowLabel(METROPOLITANO_DEMAIS_SUB_ROW_LABEL)).toBe(false)
  })
})
