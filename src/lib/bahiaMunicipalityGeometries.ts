import { feature } from 'topojson-client'

import municipalityTopologyJson from '@/lib/geometries/bahia-municipalities.topo.json'
import type {
  BahiaMunicipalityFeature,
  MunicipalityGeometryModule,
  MunicipalityTopology,
} from '@/lib/bahiaGeometriesTypes'

const topology = municipalityTopologyJson as unknown as MunicipalityTopology

const municipalityFeatures = feature(
  topology,
  topology.objects.municipalities,
).features as BahiaMunicipalityFeature[]

const municipalityByCodarea = new Map(
  municipalityFeatures.map((entry) => [entry.properties.codarea, entry]),
)

export const municipalityGeometryModule: MunicipalityGeometryModule = {
  topology,
  features: municipalityFeatures,
  getMunicipalityFeature: (codarea: string) => municipalityByCodarea.get(codarea),
}
