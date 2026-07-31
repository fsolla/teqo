import type {
  BahiaTerritoryFeature,
  TerritoryGeometryModule,
  TerritoryTopology,
} from '@/lib/bahiaGeometriesTypes'
import { buildGeometryModuleFromTopology } from '@/lib/bahiaGeometryModuleFactory'
import territoryTopologyJson from '@/lib/geometries/bahia-identity-territories.topo.json'

const { topology, features } = buildGeometryModuleFromTopology<
  BahiaTerritoryFeature['properties'],
  'territories'
>({
  topology: territoryTopologyJson as unknown as TerritoryTopology,
  objectName: 'territories',
})

export const territoryGeometryModule: TerritoryGeometryModule = {
  topology,
  features,
}
