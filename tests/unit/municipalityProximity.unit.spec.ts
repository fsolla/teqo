import { describe, expect, it } from 'vitest'

import type { BahiaMunicipalityFeature, MunicipalityZoneFeature } from '@/lib/bahiaGeometriesTypes'
import {
  featureCentroid,
  featureContainsPoint,
  findContainingMunicipality,
  formatDistanceKm,
  haversineKm,
  resolveNearbyMunicipality,
  type AccessibleMunicipality,
} from '@/lib/municipalityProximity'

/** Axis-aligned square in degrees — small enough that planar reasoning holds. */
const square = (
  codarea: string,
  name: string,
  { west, south, size }: { west: number; south: number; size: number },
): BahiaMunicipalityFeature => ({
  type: 'Feature',
  properties: { codarea, name },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [west + size, south],
        [west + size, south + size],
        [west, south + size],
        [west, south],
      ],
    ],
  },
})

const zoneSquare = (
  municipalitySlug: string,
  name: string,
  ibgeCode: string,
  { west, south, size }: { west: number; south: number; size: number },
): MunicipalityZoneFeature => ({
  type: 'Feature',
  properties: { municipalitySlug, name, ibgeCode },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [west + size, south],
        [west + size, south + size],
        [west, south + size],
        [west, south],
      ],
    ],
  },
})

const accessible = (slug: string, name: string, ibgeCode: string): AccessibleMunicipality => ({
  slug,
  name,
  ibgeCode,
})

describe('municipalityProximity', () => {
  describe('haversineKm', () => {
    it('measures a known Bahia leg (Salvador → Feira de Santana ≈ 100 km)', () => {
      const distance = haversineKm(
        { lat: -12.9714, lng: -38.5014 },
        { lat: -12.2664, lng: -38.9663 },
      )

      expect(distance).toBeGreaterThan(90)
      expect(distance).toBeLessThan(110)
    })

    it('is zero for the same point', () => {
      expect(haversineKm({ lat: -12, lng: -38 }, { lat: -12, lng: -38 })).toBe(0)
    })
  })

  describe('featureContainsPoint', () => {
    const cell = square('1', 'Quadrado', { west: -40, south: -13, size: 2 })

    it('accepts an interior point and rejects an exterior one', () => {
      expect(featureContainsPoint(cell, { lat: -12, lng: -39 })).toBe(true)
      expect(featureContainsPoint(cell, { lat: -12, lng: -35 })).toBe(false)
    })

    it('treats a hole as outside', () => {
      const donut: BahiaMunicipalityFeature = {
        type: 'Feature',
        properties: { codarea: '2', name: 'Rosca' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-40, -13],
              [-38, -13],
              [-38, -11],
              [-40, -11],
              [-40, -13],
            ],
            [
              [-39.5, -12.5],
              [-38.5, -12.5],
              [-38.5, -11.5],
              [-39.5, -11.5],
              [-39.5, -12.5],
            ],
          ],
        },
      }

      expect(featureContainsPoint(donut, { lat: -12, lng: -39 })).toBe(false)
      expect(featureContainsPoint(donut, { lat: -12.8, lng: -39.8 })).toBe(true)
    })

    it('accepts a point in any part of a multipolygon', () => {
      const island: BahiaMunicipalityFeature = {
        type: 'Feature',
        properties: { codarea: '3', name: 'Ilhas' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-40, -13],
                [-39, -13],
                [-39, -12],
                [-40, -12],
                [-40, -13],
              ],
            ],
            [
              [
                [-38, -13],
                [-37, -13],
                [-37, -12],
                [-38, -12],
                [-38, -13],
              ],
            ],
          ],
        },
      }

      expect(featureContainsPoint(island, { lat: -12.5, lng: -39.5 })).toBe(true)
      expect(featureContainsPoint(island, { lat: -12.5, lng: -37.5 })).toBe(true)
      expect(featureContainsPoint(island, { lat: -12.5, lng: -38.5 })).toBe(false)
    })
  })

  describe('findContainingMunicipality', () => {
    const west = square('1', 'Oeste', { west: -40, south: -13, size: 1 })
    const east = square('2', 'Leste', { west: -39, south: -13, size: 1 })

    it('gives a shared border to exactly one município', () => {
      const features = [west, east]
      const onBorder = { lat: -12.5, lng: -39 }

      const matches = features.filter((feature) => featureContainsPoint(feature, onBorder))
      // Exactly one, and it is the eastern feature: the half-open ray test counts
      // only crossings strictly east of the point, so a shared edge belongs to the
      // polygon whose interior lies east of it. Scan order never gets a say.
      expect(matches).toHaveLength(1)
      expect(findContainingMunicipality(features, onBorder)).toBe(east)
    })

    it('returns undefined outside every feature', () => {
      expect(findContainingMunicipality([west, east], { lat: 0, lng: 0 })).toBeUndefined()
    })
  })

  describe('featureCentroid', () => {
    it('returns the centre of a square', () => {
      const centroid = featureCentroid(square('1', 'Quadrado', { west: -40, south: -13, size: 2 }))

      expect(centroid.lng).toBeCloseTo(-39, 6)
      expect(centroid.lat).toBeCloseTo(-12, 6)
    })

    it('weights multipolygon parts by area', () => {
      const lopsided: BahiaMunicipalityFeature = {
        type: 'Feature',
        properties: { codarea: '1', name: 'Desigual' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-40, -13],
                [-36, -13],
                [-36, -9],
                [-40, -9],
                [-40, -13],
              ],
            ],
            [
              [
                [-35, -13],
                [-34, -13],
                [-34, -12],
                [-35, -12],
                [-35, -13],
              ],
            ],
          ],
        },
      }

      // Big part centred at -38, small part at -34.5: area 16 vs 1.
      expect(featureCentroid(lopsided).lng).toBeCloseTo((-38 * 16 + -34.5) / 17, 6)
    })
  })

  describe('resolveNearbyMunicipality', () => {
    const seabra = square('2929206', 'Seabra', { west: -42, south: -13, size: 1 })
    const salvador = square('2927408', 'Salvador', { west: -38.6, south: -13, size: 0.4 })
    const jequie = square('2918001', 'Jequié', { west: -41, south: -13.4, size: 0.6 })
    const features = [seabra, salvador, jequie]
    // The real caller hands over the loaded mesh module, index included.
    const geometry = {
      features,
      getMunicipalityFeature: (codarea: string) =>
        features.find((feature) => feature.properties.codarea === codarea),
    }

    it('resolves a município in scope', () => {
      const seabraEntry = accessible('seabra', 'Seabra', '2929206')

      expect(
        resolveNearbyMunicipality({
          point: { lat: -12.5, lng: -41.5 },
          geometry,
          accessible: [seabraEntry],
        }),
      ).toEqual({ kind: 'inScope', municipality: seabraEntry })
    })

    it('falls back to the filtered list for a multi-zone city without zone mesh', () => {
      expect(
        resolveNearbyMunicipality({
          point: { lat: -12.9, lng: -38.5 },
          geometry,
          accessible: [
            accessible('salvador-ze-1', 'Salvador — ZE 1', '2927408'),
            accessible('salvador-ze-2', 'Salvador — ZE 2', '2927408'),
          ],
        }),
      ).toEqual({ kind: 'zoneCity', city: 'Salvador', ibgeCode: '2927408', zoneCount: 2 })
    })

    it('resolves an accessible zone by containment when the zone mesh is present', () => {
      const zoneOne = accessible('salvador-ze-1', 'Salvador — ZE 1', '2927408')
      const zoneTwo = accessible('salvador-ze-2', 'Salvador — ZE 2', '2927408')
      const zoneGeometry = {
        features: [
          zoneSquare('salvador-ze-1', 'Salvador — ZE 1', '2927408', {
            west: -38.6,
            south: -13,
            size: 0.2,
          }),
          zoneSquare('salvador-ze-2', 'Salvador — ZE 2', '2927408', {
            west: -38.4,
            south: -13,
            size: 0.2,
          }),
        ],
      }

      expect(
        resolveNearbyMunicipality({
          point: { lat: -12.9, lng: -38.55 },
          geometry,
          zoneGeometry,
          accessible: [zoneOne, zoneTwo],
        }),
      ).toEqual({ kind: 'inScope', municipality: zoneOne, match: 'zoneContainment' })
    })

    it('offers the nearest accessible zone when the point is in the city but outside every zone polygon', () => {
      const zoneOne = accessible('salvador-ze-1', 'Salvador — ZE 1', '2927408')
      const zoneTwo = accessible('salvador-ze-2', 'Salvador — ZE 2', '2927408')
      const zoneGeometry = {
        features: [
          zoneSquare('salvador-ze-1', 'Salvador — ZE 1', '2927408', {
            west: -38.58,
            south: -12.95,
            size: 0.05,
          }),
          zoneSquare('salvador-ze-2', 'Salvador — ZE 2', '2927408', {
            west: -38.45,
            south: -12.95,
            size: 0.05,
          }),
        ],
      }

      const resolution = resolveNearbyMunicipality({
        // Inside the Salvador municipal square, outside both tiny zone squares.
        point: { lat: -12.85, lng: -38.5 },
        geometry,
        zoneGeometry,
        accessible: [zoneOne, zoneTwo],
      })

      expect(resolution.kind).toBe('inScope')
      if (resolution.kind !== 'inScope') return
      expect(resolution.match).toBe('nearestZone')
      expect(['salvador-ze-1', 'salvador-ze-2']).toContain(resolution.municipality.slug)
      expect(resolution.distanceKm).toBeGreaterThan(0)
    })

    it('names where the actor is and offers the closest município in scope', () => {
      const jequieEntry = accessible('jequie', 'Jequié', '2918001')

      const resolution = resolveNearbyMunicipality({
        point: { lat: -12.5, lng: -41.5 },
        geometry,
        accessible: [jequieEntry],
      })

      expect(resolution.kind).toBe('outOfScope')
      if (resolution.kind !== 'outOfScope') return
      expect(resolution.city).toBe('Seabra')
      expect(resolution.nearestInScope?.municipality).toEqual(jequieEntry)
      expect(resolution.nearestInScope?.distanceKm).toBeGreaterThan(0)
    })

    it('omits the suggestion when the portfolio is too far to be a shortcut', () => {
      const resolution = resolveNearbyMunicipality({
        point: { lat: -12.9, lng: -38.5 },
        geometry,
        accessible: [accessible('seabra', 'Seabra', '2929206')],
      })

      expect(resolution).toEqual({ kind: 'outOfScope', city: 'Salvador', nearestInScope: null })
    })

    it('reports a position outside Bahia, still suggesting a near portfolio', () => {
      const salvadorEntry = accessible('salvador-ze-1', 'Salvador — ZE 1', '2927408')

      const resolution = resolveNearbyMunicipality({
        // Just offshore from the Salvador square above.
        point: { lat: -12.9, lng: -38.1 },
        geometry,
        accessible: [salvadorEntry],
      })

      expect(resolution.kind).toBe('outsideBahia')
      if (resolution.kind !== 'outsideBahia') return
      expect(resolution.nearestInScope?.municipality).toEqual(salvadorEntry)
    })

    it('reports a distant position outside Bahia without a suggestion', () => {
      expect(
        resolveNearbyMunicipality({
          point: { lat: -23.55, lng: -46.63 },
          geometry,
          accessible: [accessible('seabra', 'Seabra', '2929206')],
        }),
      ).toEqual({ kind: 'outsideBahia', nearestInScope: null })
    })
  })

  describe('formatDistanceKm', () => {
    it('collapses sub-kilometre precision', () => {
      expect(formatDistanceKm(0.42)).toBe('menos de 1 km')
    })

    it('keeps one decimal while it is felt', () => {
      expect(formatDistanceKm(8.34)).toBe('8,3 km')
    })

    it('does not force a decimal that carries no information', () => {
      expect(formatDistanceKm(8)).toBe('8 km')
    })

    it('rounds once the decimal stops mattering', () => {
      expect(formatDistanceKm(38.6)).toBe('39 km')
    })
  })
})
