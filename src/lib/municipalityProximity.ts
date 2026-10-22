import type { Position } from 'geojson'

import type {
  BahiaMunicipalityFeature,
  MunicipalityGeometryModule,
  MunicipalityZoneFeature,
  PolygonalFeature,
} from '@/lib/bahiaGeometriesTypes'
import { oneDecimalFormatter } from '@/lib/electionFormat'

/**
 * B14 — "onde estou" resolvido contra a malha municipal da Bahia.
 *
 * Pure math over GeoJSON features the caller already has: the dashboard map
 * loads `bahiaMunicipalityGeometries` on mount, so the same memoized chunk
 * answers containment without a centroid artifact of its own.
 *
 * Salvador multi-zona: when the caller also supplies the B8 F2 zone mesh,
 * containment runs on the 19 ZE polygons first; centroid distance ranks only
 * the "nearest accessible zone" fallback when the point is in the city polygon
 * but outside every zone polygon (bay water, mesh gap, coarse fix).
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

type ZoneGeometryLookup = {
  features: readonly MunicipalityZoneFeature[]
}

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

type InScopeMunicipalityMatch = 'municipality' | 'zoneContainment' | 'nearestZone'

export type NearbyMunicipalityResolution =
  /** The point falls inside a município the actor can open. */
  | {
      kind: 'inScope'
      municipality: AccessibleMunicipality
      /** Omitted for a single whole-municipality unit; set for Salvador ZE paths. */
      match?: InScopeMunicipalityMatch
      /** Present when `match` is `nearestZone` — distance to the zone centroid. */
      distanceKm?: number
    }
  /**
   * The actor can open several zone municipalities in the same city but the
   * resolver could not pick one (zone mesh missing, or no zone within
   * `NEAREST_ZONE_MAX_KM`). The filtered list is the honest answer.
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
 * Even-odd ray casting, half-open on purpose: only crossings strictly east of
 * the point count (`point.lng < crossingLng`). That is what makes a point on a
 * shared border belong to exactly one município — the one whose interior lies
 * east of the edge (north, for a horizontal one) — instead of to both or neither.
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

/** Outer ring + holes per polygon, so callers stop re-writing the Polygon/MultiPolygon branch. */
export const polygonRingsOf = (feature: PolygonalFeature): readonly Position[][][] =>
  feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates

/**
 * Holes and MultiPolygons do not occur in the committed mesh (417 plain
 * Polygons), but a rebuild at finer quality would introduce them.
 */
export const featureContainsPoint = (feature: PolygonalFeature, point: GeoPoint): boolean =>
  polygonRingsOf(feature).some(([outerRing, ...holes]) => {
    if (!outerRing || !isPointInRing(point, outerRing)) return false
    return !holes.some((hole) => isPointInRing(point, hole))
  })

/**
 * Area-weighted centroid of the outer rings (planar shoelace — the distortion
 * at Bahia's latitudes is far below the precision this feeds). Holes are
 * ignored: they move the centre by less than the rounding of the label.
 */
export const featureCentroid = (feature: PolygonalFeature): GeoPoint => {
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
 * First feature whose polygons contain the point. A point on a shared border
 * lands in exactly one feature by the half-open convention in `isPointInRing`,
 * not by this scan's order: the mesh is TopoJSON-derived, so neighbours share
 * numerically identical arcs and never overlap.
 */
const findContainingFeature = <F extends PolygonalFeature>(
  features: readonly F[],
  point: GeoPoint,
): F | undefined => features.find((feature) => featureContainsPoint(feature, point))

export const findContainingMunicipality = (
  features: readonly BahiaMunicipalityFeature[],
  point: GeoPoint,
): BahiaMunicipalityFeature | undefined => findContainingFeature(features, point)

/**
 * Past this, "o mais próximo na sua carteira" stops being a shortcut and starts
 * being noise — an advisor in Salvador does not need a link to Barreiras.
 */
const NEAREST_IN_SCOPE_MAX_KM = 150

/**
 * When the point is inside Salvador's municipal polygon but outside every ZE
 * polygon, only zones within this radius are offered as a direct link.
 */
const NEAREST_ZONE_MAX_KM = 30

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

const findNearestAccessibleZone = (
  zoneFeatures: readonly MunicipalityZoneFeature[],
  accessibleBySlug: ReadonlyMap<string, AccessibleMunicipality>,
  point: GeoPoint,
): NearestInScope | null => {
  let nearest: NearestInScope | null = null

  for (const zone of zoneFeatures) {
    const municipality = accessibleBySlug.get(zone.properties.municipalitySlug)
    if (!municipality) continue

    const distanceKm = haversineKm(point, featureCentroid(zone))
    if (distanceKm > NEAREST_ZONE_MAX_KM) continue
    if (nearest && nearest.distanceKm <= distanceKm) continue

    nearest = { municipality, distanceKm }
  }

  return nearest
}

const resolveMultiZoneCity = ({
  city,
  ibgeCode,
  inCity,
  point,
  zoneGeometry,
  geometry,
  accessible,
}: {
  city: string
  ibgeCode: string
  inCity: readonly AccessibleMunicipality[]
  point: GeoPoint
  zoneGeometry: ZoneGeometryLookup | undefined
  geometry: MunicipalityGeometryLookup
  accessible: readonly AccessibleMunicipality[]
}): NearbyMunicipalityResolution => {
  if (!zoneGeometry) {
    return { kind: 'zoneCity', city, ibgeCode, zoneCount: inCity.length }
  }

  const accessibleBySlug = new Map(inCity.map((entry) => [entry.slug, entry]))
  const containingZone = findContainingFeature(zoneGeometry.features, point)

  if (containingZone) {
    const municipality = accessibleBySlug.get(containingZone.properties.municipalitySlug)
    if (municipality) {
      return { kind: 'inScope', municipality, match: 'zoneContainment' }
    }

    return {
      kind: 'outOfScope',
      city: containingZone.properties.name,
      nearestInScope: findNearestInScope(geometry.getMunicipalityFeature, accessible, point),
    }
  }

  const nearestZone = findNearestAccessibleZone(zoneGeometry.features, accessibleBySlug, point)
  if (nearestZone) {
    return {
      kind: 'inScope',
      municipality: nearestZone.municipality,
      match: 'nearestZone',
      distanceKm: nearestZone.distanceKm,
    }
  }

  return { kind: 'zoneCity', city, ibgeCode, zoneCount: inCity.length }
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
  zoneGeometry,
  accessible,
}: {
  point: GeoPoint
  geometry: MunicipalityGeometryLookup
  zoneGeometry?: ZoneGeometryLookup
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
    return resolveMultiZoneCity({
      city: containing.properties.name,
      ibgeCode: containing.properties.codarea,
      inCity,
      point,
      zoneGeometry,
      geometry,
      accessible,
    })
  }

  return {
    kind: 'outOfScope',
    city: containing.properties.name,
    nearestInScope: findNearestInScope(geometry.getMunicipalityFeature, accessible, point),
  }
}

/** Distance as field copy: precise where it is felt, rounded where it is not. */
export const formatDistanceKm = (distanceKm: number): string => {
  if (distanceKm < 1) return 'menos de 1 km'
  return `${oneDecimalFormatter.format(distanceKm < 10 ? distanceKm : Math.round(distanceKm))} km`
}
