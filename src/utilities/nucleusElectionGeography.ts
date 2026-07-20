import type { Where } from 'payload'

import { tseCityCodeForMunicipality } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import { normalizeTerritoryTextArray } from '@/utilities/campaignTerritoryValidation'
import { resolveNucleusTerritoryCities } from '@/utilities/nucleusTerritoryCities'
import type { NucleusTerritoryCitiesInput } from '@/utilities/nucleusTerritoryCities'
import { sortedUniqueZoneNumbers } from '@/utilities/tseZone'

export type NucleusElectionGeographyInput = NucleusTerritoryCitiesInput & {
  tseZones: number[]
}

export const toNucleusElectionGeographyInput = (nucleus: {
  cities?: string[] | null
  regions?: string[] | null
  tseZones?: Array<number | { zoneNumber: number }> | null
}): NucleusElectionGeographyInput => ({
  cities: normalizeTerritoryTextArray(nucleus.cities),
  regions: normalizeTerritoryTextArray(nucleus.regions),
  tseZones: (nucleus.tseZones ?? []).map((zone) =>
    typeof zone === 'number' ? zone : zone.zoneNumber,
  ),
})

export type NucleusCityZonePair = {
  cityName: string
  cityCode: string
  zoneNumber: number
}

export type NucleusElectionGeography = {
  zonesByCity: Map<string, number[]>
  cityZonePairs: NucleusCityZonePair[]
}

/**
 * Resolve the effective city×zone geography for a nucleus baseline query.
 * Returns null when the nucleus has no usable territory (no cities and no regions),
 * or when no city maps to a TSE city code (fail-closed).
 *
 * Zone rules per city:
 * - nucleus.tseZones empty → all official zones of the city (`tseZonesForCity`)
 * - nucleus.tseZones non-empty → intersection with the city's official zones;
 *   if the intersection is empty (typed zones outside the city), fall back to all city zones
 */
export const resolveNucleusElectionGeography = (
  nucleus: NucleusElectionGeographyInput,
): NucleusElectionGeography | null => {
  const cities = resolveNucleusTerritoryCities(nucleus)
  if (cities.length === 0) return null

  const requestedZones = sortedUniqueZoneNumbers(
    nucleus.tseZones.filter((zone) => Number.isInteger(zone) && zone >= 1 && zone <= 999),
  )

  const zonesByCity = new Map<string, number[]>()
  const cityZonePairs: NucleusCityZonePair[] = []

  for (const city of cities) {
    const cityCode = tseCityCodeForMunicipality(city)
    if (!cityCode) continue

    const cityZones = [...tseZonesForCity(city)]
    let effectiveZones = cityZones
    if (requestedZones.length > 0) {
      const cityZoneSet = new Set(cityZones)
      const intersection = requestedZones.filter((zone) => cityZoneSet.has(zone))
      if (intersection.length > 0) effectiveZones = intersection
    }

    if (effectiveZones.length === 0) continue

    zonesByCity.set(city, effectiveZones)
    for (const zoneNumber of effectiveZones) {
      cityZonePairs.push({ cityName: city, cityCode, zoneNumber })
    }
  }

  if (cityZonePairs.length === 0) return null

  return { zonesByCity, cityZonePairs }
}

export const zonesByCityCode = (
  geography: NucleusElectionGeography,
): Map<string, number[]> => {
  const byCode = new Map<string, number[]>()
  for (const { cityCode, zoneNumber } of geography.cityZonePairs) {
    const zones = byCode.get(cityCode)
    if (zones) zones.push(zoneNumber)
    else byCode.set(cityCode, [zoneNumber])
  }
  for (const [cityCode, zones] of byCode) {
    byCode.set(cityCode, sortedUniqueZoneNumbers(zones))
  }
  return byCode
}

/** One clause per TSE city code with `zoneNumber in […]`. */
export const geographyWhere = (geography: NucleusElectionGeography): Where => ({
  or: [...zonesByCityCode(geography).entries()].map(
    ([cityCode, zones]): Where => ({
      and: [{ cityCode: { equals: cityCode } }, { zoneNumber: { in: zones } }],
    }),
  ),
})
