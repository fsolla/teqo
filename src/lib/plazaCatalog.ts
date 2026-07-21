/**
 * Static catalog of the 436 campaign "Praças" — the predefined operational
 * territories of the /campanha vertical (see docs/plans/remodelagem-pracas.md).
 *
 * Definition (product decision 2026-07-20):
 * - One Praça per Bahia municipality (415 entries), EXCEPT
 * - Salvador → one Praça per TSE electoral zone (ZE 1–19, 19 entries), and
 * - Camaçari → one Praça per TSE electoral zone (ZE 170/171, 2 entries).
 *
 * TSE zones shared across municipalities (141, 162) or leaking outside the
 * RMS (128, 185, 200) are cut at the municipal boundary: each municipality is
 * its own Praça and election data (recorded per municipality×zone) is
 * aggregated exactly, without overlap.
 *
 * Slugs and names are canonical and immutable — they become public /campanha
 * URLs and are seeded into the `plaza` collection by migration. Stability is
 * guarded by tests/fixtures/plaza-catalog.snapshot.json.
 */

import { bahiaMunicipalityCodes } from '@/lib/bahiaMunicipalityCodes'
import {
  bahiaMunicipalities,
  territoryForCity,
  type BahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'
import { bahiaTseCityCodes } from '@/lib/bahiaTseCityCodes'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import { slugify } from '@/utilities/slug'

export type PlazaKind = 'municipio' | 'zona'

export interface PlazaCatalogEntry {
  /** Canonical immutable slug — public URL segment and seed identity. */
  readonly slug: string
  /** Display name, e.g. "Feira de Santana" or "Salvador — ZE 3". */
  readonly name: string
  readonly kind: PlazaKind
  /** Canonical municipality name (every Praça is single-municipality). */
  readonly city: string
  /** Official Bahia identity territory (TI) of the municipality. */
  readonly region: BahiaIdentityTerritory
  /** IBGE 7-digit codarea of the municipality (map geometry key). */
  readonly ibgeCode: string
  /** TSE electoral city code (election collections filter by this). */
  readonly tseCityCode: string
  /** Zone number for kind 'zona'; undefined for municipality Praças. */
  readonly zoneNumber?: number
  /** TSE zones covered: all official city zones, or the single zone. */
  readonly tseZones: readonly number[]
}

/** Municipalities modeled as one Praça per TSE zone instead of one Praça. */
export const ZONE_PLAZA_CITIES: readonly string[] = ['Salvador', 'Camaçari']

const zonePlazaCitySet = new Set(ZONE_PLAZA_CITIES)

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

const buildCatalog = (): readonly PlazaCatalogEntry[] => {
  const entries: PlazaCatalogEntry[] = []
  const sortedCities = [...bahiaMunicipalities].sort((left, right) =>
    left.localeCompare(right, 'pt-BR'),
  )

  for (const city of sortedCities) {
    const region = requireRegion(city)
    const ibgeCode = requireCode(bahiaMunicipalityCodes, city, 'IBGE code')
    const tseCityCode = requireCode(bahiaTseCityCodes, city, 'TSE city code')
    const zones = tseZonesForCity(city)
    if (zones.length === 0) throw new Error(`Missing TSE zones for municipality: ${city}`)

    if (zonePlazaCitySet.has(city)) {
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

export const plazaCatalog: readonly PlazaCatalogEntry[] = buildCatalog()

const catalogBySlug = new Map(plazaCatalog.map((entry) => [entry.slug, entry]))

const catalogByCity = new Map<string, PlazaCatalogEntry[]>()
for (const entry of plazaCatalog) {
  const list = catalogByCity.get(entry.city)
  if (list) list.push(entry)
  else catalogByCity.set(entry.city, [entry])
}

export const getPlazaCatalogEntry = (slug: string): PlazaCatalogEntry | undefined =>
  catalogBySlug.get(slug)

export const plazaCatalogEntriesForCity = (city: string): readonly PlazaCatalogEntry[] =>
  catalogByCity.get(city) ?? []

export const isPlazaSlug = (value: string): boolean => catalogBySlug.has(value)
