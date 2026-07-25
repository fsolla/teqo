import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

type BahiaMunicipalityProperties = {
  codarea: string
  name: string
}

type BahiaTerritoryProperties = {
  code: string
  name: string
}

export type BahiaMunicipalityFeature = Feature<Polygon | MultiPolygon, BahiaMunicipalityProperties>

export type BahiaTerritoryFeature = Feature<Polygon | MultiPolygon, BahiaTerritoryProperties>

export type MunicipalityTopology = Topology<{
  municipalities: GeometryCollection<BahiaMunicipalityProperties>
}>

export type TerritoryTopology = Topology<{
  territories: GeometryCollection<BahiaTerritoryProperties>
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
