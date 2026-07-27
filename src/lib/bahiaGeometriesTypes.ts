import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

/** Every committed mesh is polygonal; only the properties differ. */
type BahiaFeature<Properties> = Feature<Polygon | MultiPolygon, Properties>

type BahiaMunicipalityProperties = {
  codarea: string
  name: string
}

type BahiaTerritoryProperties = {
  code: string
  name: string
}

/**
 * Zone municipalities (Salvador ZE 1–19): keyed by the catalog slug, because a
 * zone has no IBGE code of its own — the whole city shares `ibgeCode`.
 */
type MunicipalityZoneProperties = {
  municipalitySlug: string
  name: string
  ibgeCode: string
}

export type BahiaMunicipalityFeature = BahiaFeature<BahiaMunicipalityProperties>

export type BahiaTerritoryFeature = BahiaFeature<BahiaTerritoryProperties>

export type MunicipalityZoneFeature = BahiaFeature<MunicipalityZoneProperties>

/** Any feature of the committed meshes, as the map layer receives them. */
export type BahiaMeshFeature =
  | BahiaMunicipalityFeature
  | BahiaTerritoryFeature
  | MunicipalityZoneFeature

/**
 * What the geometry helpers actually need — a polygonal geometry, nothing else.
 * Declaring the requirement instead of a feature union keeps `GeoJsonProperties`
 * (which is `any`) out of the signature of a helper that only reads coordinates.
 */
export type PolygonalFeature = { geometry: Polygon | MultiPolygon }

export type MunicipalityTopology = Topology<{
  municipalities: GeometryCollection<BahiaMunicipalityProperties>
}>

export type TerritoryTopology = Topology<{
  territories: GeometryCollection<BahiaTerritoryProperties>
}>

export type MunicipalityZoneTopology = Topology<{
  municipalityZones: GeometryCollection<MunicipalityZoneProperties>
}>

export type MunicipalityGeometryModule = {
  topology: MunicipalityTopology
  features: readonly BahiaMunicipalityFeature[]
  getMunicipalityFeature: (codarea: string) => BahiaMunicipalityFeature | undefined
}

export type TerritoryGeometryModule = {
  topology: TerritoryTopology
  features: readonly BahiaTerritoryFeature[]
}

export type MunicipalityZoneGeometryModule = {
  topology: MunicipalityZoneTopology
  features: readonly MunicipalityZoneFeature[]
}
