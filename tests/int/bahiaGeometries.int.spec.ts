// @vitest-environment node

import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { loadMunicipalityGeometryModule, loadTerritoryGeometryModule } from '@/lib/bahiaGeometries'
import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import { bahiaIdentityTerritoryRecords } from '@/lib/bahiaTerritories'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  featureCentroid,
  findContainingMunicipality,
  resolveNearbyMunicipality,
} from '@/lib/municipalityProximity'

import { featureBounds } from '../helpers/featureBounds'

/** Soft ceiling against accidental unsimplified meshes (plan target ≤ ~600 KB). */
const MAX_TOPO_BYTES = 600 * 1024

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

const hasNonEmptyGeometry = (
  geometry: { type: string; coordinates?: unknown } | null | undefined,
): boolean => {
  if (!geometry || geometry.type === 'GeometryCollection') return false
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false
  return true
}

describe('Bahia static geometries', () => {
  it('keeps committed TopoJSON under the size budget', () => {
    const municipalityBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-municipalities.topo.json'),
    ).size
    const territoryBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-identity-territories.topo.json'),
    ).size

    expect(municipalityBytes).toBeGreaterThan(10_000)
    expect(territoryBytes).toBeGreaterThan(1_000)
    expect(municipalityBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
    expect(territoryBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
  })

  it('exposes 417 municipality features whose codarea set matches the code table', async () => {
    const { topology, features, getMunicipalityFeature } = await loadMunicipalityGeometryModule()

    expect(topology.objects.municipalities.geometries).toHaveLength(417)
    expect(features).toHaveLength(417)

    const featureCodes = new Set(features.map((entry) => entry.properties.codarea))
    const tableCodes = new Set(Object.values(bahiaMunicipalityCodes))
    expect(featureCodes).toEqual(tableCodes)

    for (const entry of features) {
      expect(entry.properties.codarea).toMatch(/^29\d{5}$/)
      expect(bahiaMunicipalityCodes[entry.properties.name]).toBe(entry.properties.codarea)
      expect(hasNonEmptyGeometry(entry.geometry)).toBe(true)
    }

    expect(getMunicipalityFeature('2927408')?.properties.name).toBe('Salvador')
    expect(getMunicipalityFeature('0000000')).toBeUndefined()
  })

  it('exposes 27 territory features whose codes match bahiaIdentityTerritoryRecords', async () => {
    const { topology, features, getTerritoryFeature } = await loadTerritoryGeometryModule()

    expect(topology.objects.territories.geometries).toHaveLength(27)
    expect(features).toHaveLength(27)

    const featureCodes = features.map((entry) => entry.properties.code).sort()
    const recordCodes = bahiaIdentityTerritoryRecords.map((entry) => entry.code).sort()
    expect(featureCodes).toEqual(recordCodes)

    for (const record of bahiaIdentityTerritoryRecords) {
      const featureEntry = getTerritoryFeature(record.code)
      expect(featureEntry, record.code).toBeDefined()
      expect(featureEntry?.properties.name).toBe(record.name)
      expect(hasNonEmptyGeometry(featureEntry?.geometry)).toBe(true)
    }

    expect(getTerritoryFeature('01')?.properties.name).toBe('Irecê')
    expect(getTerritoryFeature('99')).toBeUndefined()
  })

  /**
   * B14 resolves "onde estou" against this same mesh, so the containment used in
   * the field is pinned here with real coordinates — the synthetic squares in
   * tests/unit/municipalityProximity cover the algorithm, not the data.
   */
  describe('municipality containment (B14)', () => {
    const cityCentres: ReadonlyArray<{ city: string; lat: number; lng: number }> = [
      { city: 'Salvador', lat: -12.973, lng: -38.5121 },
      { city: 'Feira de Santana', lat: -12.2664, lng: -38.9663 },
      { city: 'Vitória da Conquista', lat: -14.8615, lng: -40.8442 },
      { city: 'Seabra', lat: -12.4172, lng: -41.7702 },
    ]

    it('places known city centres in their own município', async () => {
      const { features } = await loadMunicipalityGeometryModule()

      for (const { city, lat, lng } of cityCentres) {
        const containing = findContainingMunicipality(features, { lat, lng })
        expect(containing?.properties.name, city).toBe(city)
      }
    })

    it('resolves nothing outside the state', async () => {
      const { features } = await loadMunicipalityGeometryModule()

      // Atlantic off Salvador and downtown São Paulo.
      expect(findContainingMunicipality(features, { lat: -13, lng: -37.5 })).toBeUndefined()
      expect(findContainingMunicipality(features, { lat: -23.55, lng: -46.63 })).toBeUndefined()
    })

    it('keeps every centroid inside its own bounding box', async () => {
      const { features } = await loadMunicipalityGeometryModule()

      for (const entry of features) {
        const centroid = featureCentroid(entry)
        const bounds = featureBounds(entry)

        expect(centroid.lng, entry.properties.name).toBeGreaterThanOrEqual(bounds.west)
        expect(centroid.lng, entry.properties.name).toBeLessThanOrEqual(bounds.east)
        expect(centroid.lat, entry.properties.name).toBeGreaterThanOrEqual(bounds.south)
        expect(centroid.lat, entry.properties.name).toBeLessThanOrEqual(bounds.north)
      }
    })

    it('sends a Salvador position to the zone list and an out-of-portfolio one to the nearest', async () => {
      const geometry = await loadMunicipalityGeometryModule()
      const salvadorZones = municipalityCatalog.filter((entry) => entry.city === 'Salvador')
      const seabra = municipalityCatalog.find((entry) => entry.slug === 'seabra')!
      const salvadorPoint = { lat: -12.973, lng: -38.5121 }

      expect(
        resolveNearbyMunicipality({
          point: salvadorPoint,
          geometry,
          accessible: salvadorZones,
        }),
      ).toEqual({
        kind: 'zoneCity',
        city: 'Salvador',
        ibgeCode: '2927408',
        zoneCount: salvadorZones.length,
      })

      expect(
        resolveNearbyMunicipality({
          point: salvadorPoint,
          geometry,
          accessible: [seabra],
        }),
      ).toEqual({ kind: 'outOfScope', city: 'Salvador', nearestInScope: null })
    })
  })

  it('exposes TopoJSON object names expected by consumers', async () => {
    const [municipalityModule, territoryModule] = await Promise.all([
      loadMunicipalityGeometryModule(),
      loadTerritoryGeometryModule(),
    ])

    expect(municipalityModule.topology.type).toBe('Topology')
    expect(territoryModule.topology.type).toBe('Topology')
    expect(Object.keys(municipalityModule.topology.objects)).toEqual(['municipalities'])
    expect(Object.keys(territoryModule.topology.objects)).toEqual(['territories'])
  })
})
