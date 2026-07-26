import type { BahiaMunicipalityFeature } from '../../src/lib/bahiaGeometriesTypes.js'

export type FeatureBounds = {
  west: number
  east: number
  south: number
  north: number
}

/**
 * Bounding box of every ring of a municipality feature. Type-only import on
 * purpose: this helper is shared by the vitest int suite and the Playwright e2e
 * suite, which resolve runtime modules differently.
 */
export const featureBounds = (feature: BahiaMunicipalityFeature): FeatureBounds => {
  const rings =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates
  const positions = rings.flat(2)
  const longitudes = positions.map(([lng]) => lng)
  const latitudes = positions.map(([, lat]) => lat)

  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  }
}
