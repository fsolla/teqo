/**
 * S39 — pure contract of the home section that advertises the Central de
 * Conteúdos: the lean projection of a published piece, the visitor's location
 * labels resolved from the committed Bahia meshes and the sample selection
 * (município → região → recentes).
 *
 * No I/O and no `server-only`: the cached read, the client island and the unit
 * tests share this module. The visitor's position is only ever resolved in the
 * browser — this module never sees an IP and never persists anything.
 */
import type {
  MunicipalityGeometryModule,
  MunicipalityZoneGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'
import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import { findContainingFeature, type GeoPoint } from '@/lib/municipalityProximity'
import { slugify } from '@/lib/slug'

/**
 * What the home card actually renders — the full public item carries the
 * normalized `searchText` haystack (transcript + description) and the raw
 * `description`, which must never ride the home's static HTML to every visitor.
 */
export type ContentPieceHomeItem = Pick<
  ContentPiecePublicItem,
  | 'id'
  | 'slug'
  | 'title'
  | 'type'
  | 'typeLabel'
  | 'origin'
  | 'originLabel'
  | 'isLink'
  | 'cityLabel'
  | 'regionLabel'
  | 'excerpt'
  | 'durationLabel'
  | 'metaLabel'
  | 'publicPath'
  | 'file'
>

/** Field-by-field on purpose: a new public-item field never leaks by spread. */
export const toContentPieceHomeItem = (item: ContentPiecePublicItem): ContentPieceHomeItem => ({
  id: item.id,
  slug: item.slug,
  title: item.title,
  type: item.type,
  typeLabel: item.typeLabel,
  origin: item.origin,
  originLabel: item.originLabel,
  isLink: item.isLink,
  cityLabel: item.cityLabel,
  regionLabel: item.regionLabel,
  excerpt: item.excerpt,
  durationLabel: item.durationLabel,
  metaLabel: item.metaLabel,
  publicPath: item.publicPath,
  file: item.file,
})

/**
 * Where the visitor is, in the same vocabulary the catalogue facets use: the
 * município name (a Salvador ZE resolves to "Salvador — ZE N", the exact
 * municipality record name) and the identity territory name.
 */
export type ContentPieceHomeVisitor = {
  municipalityName: string | null
  region: string | null
}

/**
 * Point → visitor labels over the committed meshes, in containment order
 * zone → município → território: the Salvador ZE mesh is finer than the
 * municipal polygon and its feature names are the catalog names, so the zone
 * match survives; a point outside the municipal mesh is outside Bahia.
 *
 * A coarse fix (network/IP guess, `accuracyM > COARSE_ACCURACY_M`) may name a
 * neighbouring município with total confidence, so only the region is kept.
 */
export const resolveContentPieceHomeVisitor = ({
  point,
  coarse = false,
  municipalityGeometry,
  zoneGeometry,
  territoryGeometry,
}: {
  point: GeoPoint
  coarse?: boolean
  municipalityGeometry: Pick<MunicipalityGeometryModule, 'features'>
  zoneGeometry?: Pick<MunicipalityZoneGeometryModule, 'features'> | null
  territoryGeometry?: Pick<TerritoryGeometryModule, 'features'> | null
}): ContentPieceHomeVisitor | null => {
  const containingZone = zoneGeometry
    ? findContainingFeature(zoneGeometry.features, point)
    : undefined
  const containingMunicipality = findContainingFeature(municipalityGeometry.features, point)

  if (!containingZone && !containingMunicipality) return null

  const municipalityName = coarse
    ? null
    : (containingZone?.properties.name ?? containingMunicipality?.properties.name ?? null)
  const region = territoryGeometry
    ? (findContainingFeature(territoryGeometry.features, point)?.properties.name ?? null)
    : null

  if (!municipalityName && !region) return null

  return { municipalityName, region }
}

/** Where a sampled piece came from — the card's provenance tag. */
export type ContentPieceHomeMatch = 'municipality' | 'region' | 'recent'

export type ContentPieceHomeSelection = {
  item: ContentPieceHomeItem
  match: ContentPieceHomeMatch
}

const normalized = (value: string | null): string => (value ? slugify(value) : '')

/**
 * Up to `limit` pieces for the visitor, in the intention's order: the município
 * first, then the region, then the newest published pieces to fill the sample.
 * `items` already arrives newest-first (the cached read sorts by `-publishedAt`),
 * so every bucket keeps that order and the dedup is by id.
 *
 * `null` (or an out-of-Bahia) visitor is the recent selection — never an error.
 */
export const selectContentPieceHomeItems = (
  items: readonly ContentPieceHomeItem[],
  visitor: ContentPieceHomeVisitor | null,
  limit = 3,
): ContentPieceHomeSelection[] => {
  const selected: ContentPieceHomeSelection[] = []
  const seen = new Set<number>()

  const take = (item: ContentPieceHomeItem, match: ContentPieceHomeMatch): void => {
    if (selected.length >= limit || seen.has(item.id)) return
    seen.add(item.id)
    selected.push({ item, match })
  }

  if (visitor) {
    const municipality = normalized(visitor.municipalityName)
    const region = normalized(visitor.region)

    if (municipality) {
      for (const item of items) {
        if (selected.length >= limit) break
        if (normalized(item.cityLabel) === municipality) take(item, 'municipality')
      }
    }
    if (region) {
      for (const item of items) {
        if (selected.length >= limit) break
        if (normalized(item.regionLabel) === region) take(item, 'region')
      }
    }
  }

  for (const item of items) {
    if (selected.length >= limit) break
    take(item, 'recent')
  }

  return selected
}
