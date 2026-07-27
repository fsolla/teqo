import { feature } from 'topojson-client'

import type {
  BahiaTerritoryFeature,
  TerritoryGeometryModule,
  TerritoryTopology,
} from '@/lib/bahiaGeometriesTypes'
import territoryTopologyJson from '@/lib/geometries/bahia-identity-territories.topo.json'

const topology = territoryTopologyJson as unknown as TerritoryTopology

const territoryFeatures = feature(topology, topology.objects.territories)
  .features as BahiaTerritoryFeature[]

export const territoryGeometryModule: TerritoryGeometryModule = {
  topology,
  features: territoryFeatures,
}
