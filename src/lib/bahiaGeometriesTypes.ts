import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

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
  zoneNumber: number
  ibgeCode: string
}

export type BahiaMunicipalityFeature = Feature<Polygon | MultiPolygon, BahiaMunicipalityProperties>

export type BahiaTerritoryFeature = Feature<Polygon | MultiPolygon, BahiaTerritoryProperties>

export type MunicipalityZoneFeature = Feature<Polygon | MultiPolygon, MunicipalityZoneProperties>

/** Any feature of the committed meshes — for helpers that only read coordinates. */
export type BahiaGeometryFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>

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
  getTerritoryFeature: (code: string) => BahiaTerritoryFeature | undefined
}

export type MunicipalityZoneGeometryModule = {
  topology: MunicipalityZoneTopology
  features: readonly MunicipalityZoneFeature[]
  getMunicipalityZoneFeature: (municipalitySlug: string) => MunicipalityZoneFeature | undefined
}
