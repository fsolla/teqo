import type { Where } from 'payload'

import {
  getMunicipalityCatalogEntry,
  type MunicipalityCatalogEntry,
} from '@/lib/municipalityCatalog'
import { isCitySlug, salvadorCity } from '@/lib/salvadorCity'

/**
 * Election-data geography of a Município: exactly one municipality (TSE cityCode)
 * and either all of its official zones (whole-municipality unit) or the single
 * zone (zona unit). Election collections are keyed by cityCode × zoneNumber,
 * so the cut at the municipal boundary is exact.
 *
 * B178 — the virtual Salvador city resolves to the WHOLE-CITY geography
 * (`cityCode × zones 1–19`), the same shape a whole municipality uses, so the
 * DB-backed elections tab reads the capital by summing its zones.
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

const cityElectionGeography = (): MunicipalityElectionGeography => ({
  cityCode: salvadorCity.tseCityCode,
  zones: [...salvadorCity.tseZones],
})

export const municipalityElectionGeographyForSlug = (
  slug: string,
): MunicipalityElectionGeography | null => {
  if (isCitySlug(slug)) return cityElectionGeography()
  const entry = getMunicipalityCatalogEntry(slug)
  return entry ? municipalityElectionGeography(entry) : null
}

/** Payload Where clause matching the municipality's city×zone cells. */
export const municipalityGeographyWhere = (geography: MunicipalityElectionGeography): Where => ({
  and: [{ cityCode: { equals: geography.cityCode } }, { zoneNumber: { in: geography.zones } }],
})
