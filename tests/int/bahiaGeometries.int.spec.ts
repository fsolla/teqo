// @vitest-environment node

import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Position } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { describe, expect, it } from 'vitest'

import type { PolygonalFeature } from '@/lib/bahiaGeometriesTypes'

import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
  loadTerritoryGeometryModule,
} from '@/lib/bahiaGeometries'
import { featureMapKey } from '@/lib/bahiaMapStyle'
import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import { bahiaIdentityTerritoryRecords } from '@/lib/bahiaTerritories'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  featureCentroid,
  featureContainsPoint,
  findContainingMunicipality,
  polygonRingsOf,
  resolveNearbyMunicipality,
} from '@/lib/municipalityProximity'

import { featureBounds } from '../helpers/featureBounds'

/** Soft ceiling against accidental unsimplified meshes (plan target ≤ ~600 KB). */
const MAX_TOPO_BYTES = 600 * 1024

/**
 * B8+ — the grandeza the ground-scale policy in `scripts/lib/topology.mjs`
 * actually controls. Bytes only catch a mesh nobody simplified at all: the zone
 * mesh shipped at 480 points/feature, 22× the state mesh, while sitting at 10% of
 * the byte budget, because a simplification tolerance copied as a *quantile* of
 * each mesh's own triangles cut Salvador's zones at ~0.6 m² and Bahia's
 * municipalities at ~1.78 km². A mesh that goes back to a relative cut fails here.
 */
const MAX_POINTS_PER_FEATURE = 60

/** Arc points over features — sound because each mesh holds exactly one object. */
const pointsPerFeature = (topology: Topology<{ [key: string]: GeometryCollection }>): number => {
  const arcPoints = topology.arcs.reduce((total, arc) => total + arc.length, 0)
  return arcPoints / Object.values(topology.objects)[0].geometries.length
}

/** Square degrees → km² at Salvador's latitude — good to a few percent, which is all this needs. */
const SQUARE_DEGREE_KM2 = 110.57 * 108.5

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

const hasNonEmptyGeometry = (
  geometry: { type: string; coordinates?: unknown } | null | undefined,
): boolean => {
  if (!geometry || geometry.type === 'GeometryCollection') return false
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false
  return true
}

/** Planar shoelace in square degrees — only ever compared against itself. */
const featureArea = (feature: PolygonalFeature): number =>
  polygonRingsOf(feature).reduce((total, [outerRing, ...holes]) => {
    const ringArea = (ring: readonly Position[]): number => {
      let sum = 0
      for (
        let current = 0, previous = ring.length - 1;
        current < ring.length;
        previous = current++
      ) {
        sum += ring[previous][0] * ring[current][1] - ring[current][0] * ring[previous][1]
      }
      return Math.abs(sum) / 2
    }

    return (
      total + ringArea(outerRing) - holes.reduce((holeTotal, hole) => holeTotal + ringArea(hole), 0)
    )
  }, 0)

describe('Bahia static geometries', () => {
  it('keeps committed TopoJSON under the size budget', () => {
    const municipalityBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-municipalities.topo.json'),
    ).size
    const territoryBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-identity-territories.topo.json'),
    ).size
    const zoneBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-municipality-zones.topo.json'),
    ).size

    expect(municipalityBytes).toBeGreaterThan(10_000)
    expect(territoryBytes).toBeGreaterThan(1_000)
    expect(zoneBytes).toBeGreaterThan(1_000)
    expect(municipalityBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
    expect(territoryBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
    expect(zoneBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
  })

  it('cuts every mesh at the shared ground scale, not at its own bbox', async () => {
    const [municipalityModule, territoryModule, zoneModule] = await Promise.all([
      loadMunicipalityGeometryModule(),
      loadTerritoryGeometryModule(),
      loadMunicipalityZoneGeometryModule(),
    ])

    for (const { topology } of [municipalityModule, territoryModule, zoneModule]) {
      const [objectName] = Object.keys(topology.objects)
      expect(pointsPerFeature(topology), objectName).toBeLessThanOrEqual(MAX_POINTS_PER_FEATURE)
    }
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
      // B8+ F2 — the map key every one of these is painted and hovered by,
      // resolved from the real properties instead of a synthetic literal.
      expect(featureMapKey(entry.properties), entry.properties.name).toBe(entry.properties.codarea)
    }

    expect(getMunicipalityFeature('2927408')?.properties.name).toBe('Salvador')
    expect(getMunicipalityFeature('0000000')).toBeUndefined()
  })

  it('exposes 27 territory features whose codes match bahiaIdentityTerritoryRecords', async () => {
    const { topology, features } = await loadTerritoryGeometryModule()

    expect(topology.objects.territories.geometries).toHaveLength(27)
    expect(features).toHaveLength(27)

    const featureCodes = features.map((entry) => entry.properties.code).sort()
    const recordCodes = bahiaIdentityTerritoryRecords.map((entry) => entry.code).sort()
    expect(featureCodes).toEqual(recordCodes)

    const territoryByCode = new Map(
      features.map((entry) => [entry.properties.code, entry] as const),
    )

    for (const record of bahiaIdentityTerritoryRecords) {
      const featureEntry = territoryByCode.get(record.code)
      expect(featureEntry, record.code).toBeDefined()
      expect(featureEntry?.properties.name).toBe(record.name)
      expect(hasNonEmptyGeometry(featureEntry?.geometry)).toBe(true)
      expect(featureMapKey(featureEntry?.properties), record.code).toBe(record.code)
    }

    expect(territoryByCode.get('01')?.properties.name).toBe('Irecê')
  })

  /**
   * B8 F2 — the 19 Salvador zones are dissolved from the IBGE neighborhood mesh,
   * a different source than the municipal mesh above, so what is pinned here is
   * the contract the map depends on: one feature per catalog zona, keyed by slug,
   * geometrically inside the city it decomposes.
   */
  describe('zone municipality geometries (B8 F2)', () => {
    const zoneCatalog = municipalityCatalog.filter((entry) => entry.kind === 'zona')

    it('exposes one feature per zona municipality, keyed by catalog slug', async () => {
      const { topology, features } = await loadMunicipalityZoneGeometryModule()

      expect(Object.keys(topology.objects)).toEqual(['municipalityZones'])
      expect(topology.objects.municipalityZones.geometries).toHaveLength(zoneCatalog.length)
      expect(features).toHaveLength(zoneCatalog.length)

      const zoneBySlug = new Map(
        features.map((zone) => [zone.properties.municipalitySlug, zone] as const),
      )

      for (const entry of zoneCatalog) {
        const zone = zoneBySlug.get(entry.slug)
        expect(zone, entry.slug).toBeDefined()
        expect(zone?.properties.name).toBe(entry.name)
        expect(zone?.properties.ibgeCode).toBe(entry.ibgeCode)
        expect(hasNonEmptyGeometry(zone?.geometry)).toBe(true)

        // B8+ F2 — a zone answers its own slug even though it also carries the
        // city's `ibgeCode`, which all 19 share and which is therefore not a key
        // property. The municipal side of the contract is pinned over all 417
        // features in the codarea test above.
        expect(featureMapKey(zone?.properties), entry.slug).toBe(entry.slug)
      }

      expect(zoneBySlug.get('feira-de-santana')).toBeUndefined()
    })

    it('keeps every zone inside the municipality it decomposes', async () => {
      const [{ getMunicipalityFeature }, { features }] = await Promise.all([
        loadMunicipalityGeometryModule(),
        loadMunicipalityZoneGeometryModule(),
      ])

      for (const zone of features) {
        const city = getMunicipalityFeature(zone.properties.ibgeCode)
        expect(city, zone.properties.municipalitySlug).toBeDefined()
        expect(
          featureContainsPoint(city!, featureCentroid(zone)),
          zone.properties.municipalitySlug,
        ).toBe(true)
      }
    })

    /**
     * Salvador's land is ~324 km². It is NOT compared against the municipal
     * polygon: that one measures ~690 km², matching the official IBGE area,
     * because the municipal limits enclose the bay water around the islands —
     * water the neighborhood mesh does not draw.
     *
     * Since each neighborhood polygon is assigned to exactly one zone, the sum is
     * also the overlap check: a neighborhood counted twice, or dropped, moves this
     * by its own area.
     */
    it('sums to Salvador’s land area, so no neighborhood is dropped or counted twice', async () => {
      const { features } = await loadMunicipalityZoneGeometryModule()

      const zoneKm2 =
        features.reduce((total, zone) => total + featureArea(zone), 0) * SQUARE_DEGREE_KM2

      expect(zoneKm2).toBeGreaterThan(280)
      expect(zoneKm2).toBeLessThan(360)
    })
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

    it('resolves Salvador to an accessible zone when the zone mesh is loaded', async () => {
      const geometry = await loadMunicipalityGeometryModule()
      const zoneGeometry = await loadMunicipalityZoneGeometryModule()
      const salvadorZones = municipalityCatalog
        .filter((entry) => entry.city === 'Salvador')
        .map((entry) => ({
          slug: entry.slug,
          name: entry.name,
          ibgeCode: entry.ibgeCode,
        }))
      const salvadorPoint = { lat: -12.973, lng: -38.5121 }

      const resolution = resolveNearbyMunicipality({
        point: salvadorPoint,
        geometry,
        zoneGeometry,
        accessible: salvadorZones,
      })

      expect(resolution.kind).toBe('inScope')
      if (resolution.kind !== 'inScope') return
      expect(resolution.match).toBe('zoneContainment')
      expect(salvadorZones.some((zone) => zone.slug === resolution.municipality.slug)).toBe(true)
    })

    it('falls back to the zone list without zone mesh and reports out-of-portfolio in Salvador', async () => {
      const geometry = await loadMunicipalityGeometryModule()
      const salvadorZones = municipalityCatalog
        .filter((entry) => entry.city === 'Salvador')
        .map((entry) => ({
          slug: entry.slug,
          name: entry.name,
          ibgeCode: entry.ibgeCode,
        }))
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
          accessible: [
            {
              slug: seabra.slug,
              name: seabra.name,
              ibgeCode: seabra.ibgeCode,
            },
          ],
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
