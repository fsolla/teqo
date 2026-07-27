/**
 * Lazy loaders for Bahia map geometries (B3 / B5 F1 / B8 F2).
 *
 * TopoJSON decode runs only when a map surface mounts — not on the default `/campanha` graph.
 * Submodules: `bahiaMunicipalityGeometries.ts`, `bahiaTerritoryGeometries.ts`,
 * `bahiaMunicipalityZoneGeometries.ts`.
 */

export type {
  MunicipalityGeometryModule,
  MunicipalityZoneGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'

import type {
  MunicipalityGeometryModule,
  MunicipalityZoneGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'

let municipalityModulePromise: Promise<MunicipalityGeometryModule> | null = null
let municipalityZoneModulePromise: Promise<MunicipalityZoneGeometryModule> | null = null
let territoryModulePromise: Promise<TerritoryGeometryModule> | null = null

export const loadMunicipalityGeometryModule = (): Promise<MunicipalityGeometryModule> => {
  municipalityModulePromise ??= import('@/lib/bahiaMunicipalityGeometries').then(
    (module) => module.municipalityGeometryModule,
  )
  return municipalityModulePromise
}

export const loadMunicipalityZoneGeometryModule = (): Promise<MunicipalityZoneGeometryModule> => {
  municipalityZoneModulePromise ??= import('@/lib/bahiaMunicipalityZoneGeometries').then(
    (module) => module.municipalityZoneGeometryModule,
  )
  return municipalityZoneModulePromise
}

export const loadTerritoryGeometryModule = (): Promise<TerritoryGeometryModule> => {
  territoryModulePromise ??= import('@/lib/bahiaTerritoryGeometries').then(
    (module) => module.territoryGeometryModule,
  )
  return territoryModulePromise
}
