import type {
  BahiaMunicipalityFeature,
  MunicipalityGeometryModule,
  MunicipalityTopology,
} from '@/lib/bahiaGeometriesTypes'
import { buildGeometryModuleFromTopology } from '@/lib/bahiaGeometryModuleFactory'
import municipalityTopologyJson from '@/lib/geometries/bahia-municipalities.topo.json'

const { topology, features, getFeatureByKey } = buildGeometryModuleFromTopology({
  topology: municipalityTopologyJson as unknown as MunicipalityTopology,
  objectName: 'municipalities',
  keyProperty: 'codarea',
})

export const municipalityGeometryModule: MunicipalityGeometryModule = {
  topology,
  features: features as readonly BahiaMunicipalityFeature[],
  getMunicipalityFeature: getFeatureByKey,
}
