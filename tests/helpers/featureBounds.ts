import type { PolygonalFeature } from '../../src/lib/bahiaGeometriesTypes.js'
import { polygonRingsOf } from '../../src/lib/municipalityProximity.js'

export type FeatureBounds = {
  west: number
  east: number
  south: number
  north: number
}

/** Bounding box of every ring of a mesh feature. Shared by the int and e2e suites. */
export const featureBounds = (feature: PolygonalFeature): FeatureBounds => {
  const positions = polygonRingsOf(feature).flat(2)
  const longitudes = positions.map(([lng]) => lng)
  const latitudes = positions.map(([, lat]) => lat)

  return {
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  }
}
