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

const territoryByCode = new Map(territoryFeatures.map((entry) => [entry.properties.code, entry]))

export const territoryGeometryModule: TerritoryGeometryModule = {
  topology,
  features: territoryFeatures,
  getTerritoryFeature: (code: string) => territoryByCode.get(code),
}
