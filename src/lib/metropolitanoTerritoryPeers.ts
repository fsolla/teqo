/**
 * E12+ — Metropolitano de Salvador peer/sub-row rules (client-safe).
 *
 * The Metropolitano TI is always split: Salvador (19 zone municipalities) vs
 * demais RMS municipalities. Same rule for territory rollups (E17/E12), aggregate
 * class slugs, and intra-TI capture benchmark (T4).
 */

import { municipalityCatalog, type MunicipalityCatalogEntry } from '@/lib/municipalityCatalog'

export const METROPOLITANO_REGION = 'Metropolitano de Salvador'
export const SALVADOR_CITY = 'Salvador'
export const METROPOLITANO_SALVADOR_SUB_ROW_LABEL = 'Salvador (19 zonas)'
export const METROPOLITANO_DEMAIS_SUB_ROW_LABEL = 'Demais municípios da RMS'

export type MetropolitanoGeo = {
  region: string
  city: string
}

const isMetropolitanoRegion = (region: string): boolean => region === METROPOLITANO_REGION

export const isSalvadorSubMunicipality = (geo: MetropolitanoGeo): boolean =>
  isMetropolitanoRegion(geo.region) && geo.city === SALVADOR_CITY

const isDemaisRmsSubMunicipality = (geo: MetropolitanoGeo): boolean =>
  isMetropolitanoRegion(geo.region) && geo.city !== SALVADOR_CITY

export const isSalvadorMetropolitanoSubRowLabel = (label: string): boolean =>
  label === METROPOLITANO_SALVADOR_SUB_ROW_LABEL

export const filterSalvadorSubgroup = <T extends MetropolitanoGeo>(items: ReadonlyArray<T>): T[] =>
  items.filter(isSalvadorSubMunicipality)

export const filterDemaisRmsSubgroup = <T extends MetropolitanoGeo>(items: ReadonlyArray<T>): T[] =>
  items.filter(isDemaisRmsSubMunicipality)

const peersForCatalogEntry = (
  entry: MunicipalityCatalogEntry,
): ReadonlyArray<MunicipalityCatalogEntry> => {
  if (!isMetropolitanoRegion(entry.region)) {
    return municipalityCatalog.filter((row) => row.region === entry.region)
  }

  return isSalvadorSubMunicipality(entry)
    ? municipalityCatalog.filter(isSalvadorSubMunicipality)
    : municipalityCatalog.filter(isDemaisRmsSubMunicipality)
}

/** Catalog peers for one slug — TI-wide, or Metropolitano Salvador vs demais RMS. */
export const catalogPeersForSlug = (slug: string): ReadonlyArray<MunicipalityCatalogEntry> => {
  const entry = municipalityCatalog.find((row) => row.slug === slug)
  if (!entry) return []
  return peersForCatalogEntry(entry)
}
