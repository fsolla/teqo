import type { Where } from 'payload'

import { getMunicipalityCatalogEntry, type MunicipalityCatalogEntry } from '@/lib/municipalityCatalog'

/**
 * Election-data geography of a Praça: exactly one municipality (TSE cityCode)
 * and either all of its official zones (municipality Praça) or the single
 * zone (zone Praça). Election collections are keyed by cityCode × zoneNumber,
 * so the cut at the municipal boundary is exact.
 */
export type MunicipalityElectionGeography = {
  cityCode: string
  zones: number[]
}

export const municipalityElectionGeography = (
  entry: Pick<MunicipalityCatalogEntry, 'tseCityCode' | 'tseZones'>,
): MunicipalityElectionGeography => ({
  cityCode: entry.tseCityCode,
  zones: [...entry.tseZones],
})

export const municipalityElectionGeographyForSlug = (slug: string): MunicipalityElectionGeography | null => {
  const entry = getMunicipalityCatalogEntry(slug)
  return entry ? municipalityElectionGeography(entry) : null
}

/** Payload Where clause matching the municipality's city×zone cells. */
export const municipalityGeographyWhere = (geography: MunicipalityElectionGeography): Where => ({
  and: [{ cityCode: { equals: geography.cityCode } }, { zoneNumber: { in: geography.zones } }],
})

export const zonesByCityCode = (geography: MunicipalityElectionGeography): Map<string, number[]> =>
  new Map([[geography.cityCode, [...geography.zones]]])
