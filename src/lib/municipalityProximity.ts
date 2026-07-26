import type { Position } from 'geojson'

import type {
  BahiaMunicipalityFeature,
  MunicipalityGeometryModule,
} from '@/lib/bahiaGeometriesTypes'

/**
 * B14 — "onde estou" resolvido contra a malha municipal da Bahia.
 *
 * Pure math over GeoJSON features the caller already has: the dashboard map
 * loads `bahiaMunicipalityGeometries` on mount, so the same memoized chunk
 * answers containment without a centroid artifact of its own.
 *
 * Containment is the real answer ("o município onde estou"); the centroid
 * distance below only ranks the fallback suggestions, where being off by a few
 * kilometres changes nothing.
 */

export type GeoPoint = {
  lat: number
  lng: number
}

/**
 * What the resolver needs from the loaded mesh: the features to scan for
 * containment, and the module's own memoized `codarea` index so the fallback
 * does not re-scan 417 features once per município in the portfolio.
 */
type MunicipalityGeometryLookup = Pick<
  MunicipalityGeometryModule,
  'features' | 'getMunicipalityFeature'
>

/** The minimum a município needs to be linkable — what the server ships to the island. */
export type AccessibleMunicipality = {
  slug: string
  name: string
  ibgeCode: string
}

type NearestInScope = {
  municipality: AccessibleMunicipality
  /** Straight-line distance to the município's approximate centre. */
  distanceKm: number
}

export type NearbyMunicipalityResolution =
  /** The point falls inside a município the actor can open. */
  | { kind: 'inScope'; municipality: AccessibleMunicipality }
  /**
   * The point falls inside a city modeled as several zone municipalities
   * (Salvador). Without zone polygons (B8 F2) the honest answer is the filtered
   * list, never a guessed ZE. `zoneCount` is what the actor can open, so an
   * advisor with three zones is not told there are nineteen. `ibgeCode` is how
   * the caller finds the filtered-list href the server serialized for it.
   */
  | { kind: 'zoneCity'; city: string; ibgeCode: string; zoneCount: number }
  /** Inside Bahia, but in a município outside the actor's portfolio. */
  | { kind: 'outOfScope'; city: string; nearestInScope: NearestInScope | null }
  /** No Bahia município contains the point. */
  | { kind: 'outsideBahia'; nearestInScope: NearestInScope | null }

const EARTH_RADIUS_KM = 6371

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/** Great-circle distance — enough for "está a ~38 km", not for surveying. */
export const haversineKm = (from: GeoPoint, to: GeoPoint): number => {
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const chord =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(chord)))
}

/**
 * Even-odd ray casting. A point exactly on a ring is undefined by construction,
 * which is why `findContainingMunicipality` documents a deterministic tie-break
 * instead of pretending shared borders belong to nobody.
 */
const isPointInRing = (point: GeoPoint, ring: readonly Position[]): boolean => {
  let inside = false

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current]
    const [previousLng, previousLat] = ring[previous]

    const straddlesRay = currentLat > point.lat !== previousLat > point.lat
    if (!straddlesRay) continue

    const crossingLng =
      currentLng +
      ((point.lat - currentLat) / (previousLat - currentLat)) * (previousLng - currentLng)

    if (point.lng < crossingLng) inside = !inside
  }

  return inside
}

const polygonRingsOf = (feature: BahiaMunicipalityFeature): readonly Position[][][] =>
  feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates

/**
 * Holes and MultiPolygons do not occur in the committed mesh (417 plain
 * Polygons), but a rebuild at finer quality would introduce them.
 */
export const featureContainsPoint = (feature: BahiaMunicipalityFeature, point: GeoPoint): boolean =>
  polygonRingsOf(feature).some(([outerRing, ...holes]) => {
    if (!outerRing || !isPointInRing(point, outerRing)) return false
    return !holes.some((hole) => isPointInRing(point, hole))
  })

/**
 * Area-weighted centroid of the outer rings (planar shoelace — the distortion
 * at Bahia's latitudes is far below the precision this feeds). Holes are
 * ignored: they move the centre by less than the rounding of the label.
 */
export const featureCentroid = (feature: BahiaMunicipalityFeature): GeoPoint => {
  let weightedLng = 0
  let weightedLat = 0
  let totalArea = 0

  for (const [outerRing] of polygonRingsOf(feature)) {
    if (!outerRing || outerRing.length < 3) continue

    let signedArea = 0
    let ringLng = 0
    let ringLat = 0

    for (
      let current = 0, previous = outerRing.length - 1;
      current < outerRing.length;
      previous = current++
    ) {
      const [currentLng, currentLat] = outerRing[current]
      const [previousLng, previousLat] = outerRing[previous]
      const cross = previousLng * currentLat - currentLng * previousLat

      signedArea += cross
      ringLng += (previousLng + currentLng) * cross
      ringLat += (previousLat + currentLat) * cross
    }

    const area = Math.abs(signedArea) / 2
    if (area === 0) continue

    totalArea += area
    weightedLng += (ringLng / (3 * signedArea)) * area
    weightedLat += (ringLat / (3 * signedArea)) * area
  }

  if (totalArea === 0) {
    // Degenerate ring — no feature in the committed mesh is like this (pinned by
    // the centroid-in-bbox int test). The first vertex keeps NaN out downstream.
    const [lng = 0, lat = 0] = polygonRingsOf(feature)[0]?.[0]?.[0] ?? []
    return { lat, lng }
  }

  return { lat: weightedLat / totalArea, lng: weightedLng / totalArea }
}

/**
 * First feature whose polygons contain the point. Shared borders are resolved
 * by feature order, so a point on a boundary belongs to exactly one município —
 * never to both, never to none.
 */
export const findContainingMunicipality = (
  features: readonly BahiaMunicipalityFeature[],
  point: GeoPoint,
): BahiaMunicipalityFeature | undefined =>
  features.find((feature) => featureContainsPoint(feature, point))

/**
 * Past this, "o mais próximo na sua carteira" stops being a shortcut and starts
 * being noise — an advisor in Salvador does not need a link to Barreiras.
 */
const NEAREST_IN_SCOPE_MAX_KM = 150

const findNearestInScope = (
  getMunicipalityFeature: MunicipalityGeometryLookup['getMunicipalityFeature'],
  accessible: readonly AccessibleMunicipality[],
  point: GeoPoint,
): NearestInScope | null => {
  let nearest: NearestInScope | null = null

  for (const municipality of accessible) {
    const feature = getMunicipalityFeature(municipality.ibgeCode)
    if (!feature) continue

    const distanceKm = haversineKm(point, featureCentroid(feature))
    if (distanceKm > NEAREST_IN_SCOPE_MAX_KM) continue
    if (nearest && nearest.distanceKm <= distanceKm) continue

    nearest = { municipality, distanceKm }
  }

  return nearest
}

/**
 * Resolves a browser position into the one município the card should offer.
 *
 * `accessible` is the actor's readable set, so an advisor standing outside his
 * portfolio is told where he is AND offered the closest município he can open.
 * An empty set is the caller's business: the card refuses to render or ask for a
 * position at all in that case, so this function does not repeat the policy.
 */
export const resolveNearbyMunicipality = ({
  point,
  geometry,
  accessible,
}: {
  point: GeoPoint
  geometry: MunicipalityGeometryLookup
  accessible: readonly AccessibleMunicipality[]
}): NearbyMunicipalityResolution => {
  const containing = findContainingMunicipality(geometry.features, point)

  if (!containing) {
    return {
      kind: 'outsideBahia',
      nearestInScope: findNearestInScope(geometry.getMunicipalityFeature, accessible, point),
    }
  }

  const inCity = accessible.filter(
    (municipality) => municipality.ibgeCode === containing.properties.codarea,
  )

  if (inCity.length === 1) return { kind: 'inScope', municipality: inCity[0] }
  if (inCity.length > 1) {
    return {
      kind: 'zoneCity',
      city: containing.properties.name,
      ibgeCode: containing.properties.codarea,
      zoneCount: inCity.length,
    }
  }

  return {
    kind: 'outOfScope',
    city: containing.properties.name,
    nearestInScope: findNearestInScope(geometry.getMunicipalityFeature, accessible, point),
  }
}

const kmFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Distance as field copy: precise where it is felt, rounded where it is not. */
export const formatDistanceKm = (distanceKm: number): string => {
  if (distanceKm < 1) return 'menos de 1 km'
  return `${kmFormatter.format(distanceKm < 10 ? distanceKm : Math.round(distanceKm))} km`
}
