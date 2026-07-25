/**
 * Lazy loaders for Bahia map geometries (B3 / B5 F1).
 *
 * TopoJSON decode runs only when a map surface mounts — not on the default `/campanha` graph.
 * Submodules: `bahiaMunicipalityGeometries.ts`, `bahiaTerritoryGeometries.ts`.
 */

export type {
  MunicipalityGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'

import type {
  MunicipalityGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'

let municipalityModulePromise: Promise<MunicipalityGeometryModule> | null = null
let territoryModulePromise: Promise<TerritoryGeometryModule> | null = null

export const loadMunicipalityGeometryModule = (): Promise<MunicipalityGeometryModule> => {
  municipalityModulePromise ??= import('@/lib/bahiaMunicipalityGeometries').then(
    (module) => module.municipalityGeometryModule,
  )
  return municipalityModulePromise
}

export const loadTerritoryGeometryModule = (): Promise<TerritoryGeometryModule> => {
  territoryModulePromise ??= import('@/lib/bahiaTerritoryGeometries').then(
    (module) => module.territoryGeometryModule,
  )
  return territoryModulePromise
}
