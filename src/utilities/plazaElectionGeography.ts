import type { Where } from 'payload'

import { getPlazaCatalogEntry, type PlazaCatalogEntry } from '@/lib/plazaCatalog'

/**
 * Election-data geography of a Praça: exactly one municipality (TSE cityCode)
 * and either all of its official zones (municipality Praça) or the single
 * zone (zone Praça). Election collections are keyed by cityCode × zoneNumber,
 * so the cut at the municipal boundary is exact.
 */
export type PlazaElectionGeography = {
  cityCode: string
  zones: number[]
}

export const plazaElectionGeography = (
  entry: Pick<PlazaCatalogEntry, 'tseCityCode' | 'tseZones'>,
): PlazaElectionGeography => ({
  cityCode: entry.tseCityCode,
  zones: [...entry.tseZones],
})

export const plazaElectionGeographyForSlug = (slug: string): PlazaElectionGeography | null => {
  const entry = getPlazaCatalogEntry(slug)
  return entry ? plazaElectionGeography(entry) : null
}

/** Payload Where clause matching the plaza's city×zone cells. */
export const plazaGeographyWhere = (geography: PlazaElectionGeography): Where => ({
  and: [{ cityCode: { equals: geography.cityCode } }, { zoneNumber: { in: geography.zones } }],
})

export const zonesByCityCode = (geography: PlazaElectionGeography): Map<string, number[]> =>
  new Map([[geography.cityCode, [...geography.zones]]])
