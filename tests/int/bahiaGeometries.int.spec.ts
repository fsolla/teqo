// @vitest-environment node

import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  bahiaIdentityTerritoriesTopology,
  bahiaMunicipalitiesTopology,
  bahiaMunicipalityFeatures,
  bahiaTerritoryFeatures,
  getMunicipalityFeature,
  getTerritoryFeature,
} from '@/lib/bahiaGeometries'
import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import { bahiaIdentityTerritoryRecords } from '@/lib/bahiaTerritories'

/** Soft ceiling against accidental unsimplified meshes (plan target ≤ ~600 KB). */
const MAX_TOPO_BYTES = 600 * 1024

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

const hasNonEmptyGeometry = (
  geometry: { type: string; coordinates?: unknown } | null | undefined,
): boolean => {
  if (!geometry || geometry.type === 'GeometryCollection') return false
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false
  return true
}

describe('Bahia static geometries', () => {
  it('keeps committed TopoJSON under the size budget', () => {
    const municipalityBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-municipalities.topo.json'),
    ).size
    const territoryBytes = statSync(
      join(repoRoot, 'src/lib/geometries/bahia-identity-territories.topo.json'),
    ).size

    expect(municipalityBytes).toBeGreaterThan(10_000)
    expect(territoryBytes).toBeGreaterThan(1_000)
    expect(municipalityBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
    expect(territoryBytes).toBeLessThanOrEqual(MAX_TOPO_BYTES)
  })

  it('exposes 417 municipality features whose codarea set matches the code table', () => {
    expect(bahiaMunicipalitiesTopology.objects.municipalities.geometries).toHaveLength(417)
    expect(bahiaMunicipalityFeatures).toHaveLength(417)

    const featureCodes = new Set(
      bahiaMunicipalityFeatures.map((entry) => entry.properties.codarea),
    )
    const tableCodes = new Set(Object.values(bahiaMunicipalityCodes))
    expect(featureCodes).toEqual(tableCodes)

    for (const entry of bahiaMunicipalityFeatures) {
      expect(entry.properties.codarea).toMatch(/^29\d{5}$/)
      expect(bahiaMunicipalityCodes[entry.properties.name]).toBe(entry.properties.codarea)
      expect(hasNonEmptyGeometry(entry.geometry)).toBe(true)
    }
  })

  it('exposes 27 territory features whose codes match bahiaIdentityTerritoryRecords', () => {
    expect(bahiaIdentityTerritoriesTopology.objects.territories.geometries).toHaveLength(27)
    expect(bahiaTerritoryFeatures).toHaveLength(27)

    const featureCodes = bahiaTerritoryFeatures
      .map((entry) => entry.properties.code)
      .sort()
    const recordCodes = bahiaIdentityTerritoryRecords.map((entry) => entry.code).sort()
    expect(featureCodes).toEqual(recordCodes)

    for (const record of bahiaIdentityTerritoryRecords) {
      const feature = getTerritoryFeature(record.code)
      expect(feature, record.code).toBeDefined()
      expect(feature?.properties.name).toBe(record.name)
      expect(hasNonEmptyGeometry(feature?.geometry)).toBe(true)
    }
  })

  it('looks up municipality and territory features by stable keys', () => {
    const salvador = getMunicipalityFeature('2927408')
    expect(salvador?.properties.name).toBe('Salvador')
    expect(hasNonEmptyGeometry(salvador?.geometry)).toBe(true)

    const irece = getTerritoryFeature('01')
    expect(irece?.properties.name).toBe('Irecê')
    expect(hasNonEmptyGeometry(irece?.geometry)).toBe(true)

    expect(getMunicipalityFeature('0000000')).toBeUndefined()
    expect(getTerritoryFeature('99')).toBeUndefined()
  })

  it('exposes TopoJSON object names expected by consumers', () => {
    expect(bahiaMunicipalitiesTopology.type).toBe('Topology')
    expect(bahiaIdentityTerritoriesTopology.type).toBe('Topology')
    expect(Object.keys(bahiaMunicipalitiesTopology.objects)).toEqual(['municipalities'])
    expect(Object.keys(bahiaIdentityTerritoriesTopology.objects)).toEqual(['territories'])
  })
})
