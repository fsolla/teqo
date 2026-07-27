import { feature } from 'topojson-client'

import type {
  MunicipalityZoneFeature,
  MunicipalityZoneGeometryModule,
  MunicipalityZoneTopology,
} from '@/lib/bahiaGeometriesTypes'
import municipalityZoneTopologyJson from '@/lib/geometries/bahia-municipality-zones.topo.json'

const topology = municipalityZoneTopologyJson as unknown as MunicipalityZoneTopology

const municipalityZoneFeatures = feature(topology, topology.objects.municipalityZones)
  .features as MunicipalityZoneFeature[]

const zoneBySlug = new Map(
  municipalityZoneFeatures.map((entry) => [entry.properties.municipalitySlug, entry]),
)

export const municipalityZoneGeometryModule: MunicipalityZoneGeometryModule = {
  topology,
  features: municipalityZoneFeatures,
  getMunicipalityZoneFeature: (municipalitySlug: string) => zoneBySlug.get(municipalitySlug),
}
