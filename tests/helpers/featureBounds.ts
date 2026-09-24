import type { PolygonalFeature } from '../../src/lib/bahiaGeometriesTypes.js'
import {
  featureContainsPoint,
  polygonRingsOf,
  type GeoPoint,
} from '../../src/lib/municipalityProximity.js'

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

/**
 * A real interior point of the feature: a centroid can fall outside a concave
 * município, so scan a coarse grid inside the bounding box (shared by the B14
 * geo spec and the S39 home sample spec).
 */
export const interiorPointOf = (feature: PolygonalFeature): GeoPoint => {
  const { west, east, south, north } = featureBounds(feature)
  const steps = 24

  for (let row = 1; row < steps; row += 1) {
    for (let column = 1; column < steps; column += 1) {
      const point = {
        lng: west + ((east - west) * column) / steps,
        lat: south + ((north - south) * row) / steps,
      }
      if (featureContainsPoint(feature, point)) return point
    }
  }

  throw new Error('No interior point found in the feature bounding box.')
}
