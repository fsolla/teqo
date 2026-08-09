/**
 * B178 — Salvador as a derived city surface on top of the 19 zone
 * municipalities (salvador-ze-1…19). Client-safe and pure: this module holds
 * the descriptor and the label constants — it imports ONLY the municipality
 * catalog (already shared with the client), never the election artifact.
 *
 * The artifact-folded aggregates (baseline, competitive rank, vote entries)
 * live in `src/utilities/municipality/salvadorCityAggregates.ts` (server-only)
 * so the 623 KB committed baseline never reaches the browser bundle.
 *
 * Guardrail de dupla contagem (structural): Salvador-as-city NEVER enters
 * `municipalityCatalog` (still 435 operational units), never enters the
 * election artifact, and never gets its own votes — `cityFederalBaseline` is a
 * derived VIEW that sums the 19 zone keys, so every aggregate consumer that
 * iterates the catalog or the artifact cannot double count it. The list bundle
 * builds a synthetic row from this module; the city page reads it directly.
 */

import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import {
  getMunicipalityCatalogEntry,
  municipalityCatalogEntriesForCity,
} from '@/lib/municipalityCatalog'

const SALVADOR_CITY = 'Salvador' as const

/** The virtual city's immutable URL segment — NOT a catalog slug. */
export const SALVADOR_CITY_SLUG = 'salvador' as const

/** List/detail display name of the aggregate row — "Salvador" is the city, the row is the aggregate. */
const SALVADOR_CITY_DISPLAY_NAME = 'Salvador (cidade)' as const

export const SALVADOR_CITY_AGGREGATE_LABEL = 'Agregado das 19 zonas' as const

export type SalvadorCityDescriptor = {
  slug: typeof SALVADOR_CITY_SLUG
  name: typeof SALVADOR_CITY_DISPLAY_NAME
  city: typeof SALVADOR_CITY
  region: BahiaIdentityTerritory
  ibgeCode: string
  tseCityCode: string
  /** The 19 catalog zone slugs the city aggregates. */
  zoneSlugs: readonly string[]
  /** TSE zone numbers 1–19. */
  tseZones: readonly number[]
}

/** The 19 ZE entries, ordered by zone number (catalog order). */
export const salvadorZoneCatalogEntries = (): ReturnType<
  typeof municipalityCatalogEntriesForCity
> => municipalityCatalogEntriesForCity(SALVADOR_CITY)

const buildSalvadorCityDescriptor = (): SalvadorCityDescriptor => {
  const zoneEntries = salvadorZoneCatalogEntries()
  if (zoneEntries.length !== 19) {
    // The catalog is the frozen 435 snapshot; Salvador's 19 ZEs are a product
    // invariant of the remodel — fail loudly instead of aggregating a drift.
    throw new Error(
      `salvadorCity: expected 19 zone entries for Salvador, found ${zoneEntries.length}`,
    )
  }
  const first = zoneEntries[0]!
  return {
    slug: SALVADOR_CITY_SLUG,
    name: SALVADOR_CITY_DISPLAY_NAME,
    city: SALVADOR_CITY,
    region: first.region,
    ibgeCode: first.ibgeCode,
    tseCityCode: first.tseCityCode,
    zoneSlugs: zoneEntries.map((entry) => entry.slug),
    tseZones: zoneEntries.flatMap((entry) => entry.tseZones),
  }
}

export const salvadorCity: SalvadorCityDescriptor = buildSalvadorCityDescriptor()

/** The only city slug today; a future city would extend this predicate. */
export const isCitySlug = (slug: string): boolean => slug === SALVADOR_CITY_SLUG

/**
 * City-aware display name: the virtual city first, then the catalog. Used by
 * client surfaces that label slugs (filter popovers, omnibox chips/seeds)
 * where the city must never render as a raw slug.
 */
export const municipalityDisplayNameForSlug = (slug: string): string | null => {
  if (isCitySlug(slug)) return salvadorCity.name
  return getMunicipalityCatalogEntry(slug)?.name ?? null
}
