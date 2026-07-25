/**
 * Static catalog of the 435 campaign municipalities — the predefined operational
 * territories of the /campanha vertical (see docs/plans/remodelagem-municipios.md).
 *
 * Definition (product decision 2026-07-23):
 * - One municipality per Bahia municipality (416 entries), EXCEPT
 * - Salvador → one entry per TSE electoral zone (ZE 1–19, 19 entries).
 * - Camaçari is a single municipality entry (ZE 170/171 aggregated).
 *
 * TSE zones shared across municipalities (141, 162) or leaking outside the
 * RMS (128, 185, 200) are cut at the municipal boundary.
 *
 * Slugs and names are canonical and immutable — they become public /campanha
 * URLs and are seeded into the `municipality` collection by migration. Stability is
 * guarded by tests/fixtures/municipality-catalog.snapshot.json.
 */

import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import {
  bahiaMunicipalities,
  territoryForCity,
  type BahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'
import { bahiaTseCityCodes } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import { slugify } from '@/lib/slug'

type MunicipalityKind = 'municipio' | 'zona'

export interface MunicipalityCatalogEntry {
  /** Canonical immutable slug — public URL segment and seed identity. */
  readonly slug: string
  /** Display name, e.g. "Feira de Santana" or "Salvador — ZE 3". */
  readonly name: string
  readonly kind: MunicipalityKind
  /** Canonical municipality name (every catalog unit is single-municipality). */
  readonly city: string
  /** Official Bahia identity territory (TI) of the municipality. */
  readonly region: BahiaIdentityTerritory
  /** IBGE 7-digit codarea of the municipality (map geometry key). */
  readonly ibgeCode: string
  /** TSE electoral city code (election collections filter by this). */
  readonly tseCityCode: string
  /** Zone number for kind 'zona'; undefined for whole-municipality entries. */
  readonly zoneNumber?: number
  /** TSE zones covered: all official city zones, or the single zone. */
  readonly tseZones: readonly number[]
}

/** Municipalities modeled as one entry per TSE zone instead of one whole municipality. */
export const ZONE_MUNICIPALITY_CITIES: readonly string[] = ['Salvador']

const zoneMunicipalityCitySet = new Set(ZONE_MUNICIPALITY_CITIES)

const requireRegion = (city: string): BahiaIdentityTerritory => {
  const region = territoryForCity(city)
  if (!region) throw new Error(`Missing identity territory for municipality: ${city}`)
  return region
}

const requireCode = (
  table: Readonly<Record<string, string>>,
  city: string,
  label: string,
): string => {
  const code = table[city]
  if (!code) throw new Error(`Missing ${label} for municipality: ${city}`)
  return code
}

const buildCatalog = (): readonly MunicipalityCatalogEntry[] => {
  const entries: MunicipalityCatalogEntry[] = []
  const sortedCities = [...bahiaMunicipalities].sort((left, right) =>
    left.localeCompare(right, 'pt-BR'),
  )

  for (const city of sortedCities) {
    const region = requireRegion(city)
    const ibgeCode = requireCode(bahiaMunicipalityCodes, city, 'IBGE code')
    const tseCityCode = requireCode(bahiaTseCityCodes, city, 'TSE city code')
    const zones = tseZonesForCity(city)
    if (zones.length === 0) throw new Error(`Missing TSE zones for municipality: ${city}`)

    if (zoneMunicipalityCitySet.has(city)) {
      for (const zoneNumber of [...zones].sort((left, right) => left - right)) {
        entries.push({
          slug: `${slugify(city)}-ze-${zoneNumber}`,
          name: `${city} — ZE ${zoneNumber}`,
          kind: 'zona',
          city,
          region,
          ibgeCode,
          tseCityCode,
          zoneNumber,
          tseZones: [zoneNumber],
        })
      }
    } else {
      entries.push({
        slug: slugify(city),
        name: city,
        kind: 'municipio',
        city,
        region,
        ibgeCode,
        tseCityCode,
        tseZones: [...zones].sort((left, right) => left - right),
      })
    }
  }

  return entries
}

export const municipalityCatalog: readonly MunicipalityCatalogEntry[] = buildCatalog()

const catalogBySlug = new Map(municipalityCatalog.map((entry) => [entry.slug, entry]))

const catalogByCity = new Map<string, MunicipalityCatalogEntry[]>()
for (const entry of municipalityCatalog) {
  const list = catalogByCity.get(entry.city)
  if (list) list.push(entry)
  else catalogByCity.set(entry.city, [entry])
}

export const getMunicipalityCatalogEntry = (slug: string): MunicipalityCatalogEntry | undefined =>
  catalogBySlug.get(slug)

export const municipalityCatalogEntriesForCity = (
  city: string,
): readonly MunicipalityCatalogEntry[] => catalogByCity.get(city) ?? []

export const isMunicipalitySlug = (value: string): boolean => catalogBySlug.has(value)
