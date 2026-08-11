import { bahiaIdentityTerritories, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { citiesForTseZone } from '@/lib/bahiaTseZones'
import {
  getMunicipalityCatalogEntry,
  municipalityCatalog,
  municipalityCatalogEntriesForCity,
  ZONE_MUNICIPALITY_CITIES,
  type MunicipalityCatalogEntry,
} from '@/lib/municipalityCatalog'
import { matchesNormalizedAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'

/**
 * Pure catalog logic behind every municipality relation edited by chips
 * (advisor carteira, leadership municipalities): group a set of assigned
 * municipalities into chips (collapsing a complete identity territory into one)
 * and search the catalog by município, território de identidade or zona
 * eleitoral. Nothing here is advisor-specific.
 */
/**
 * Payload-minimal: name and região are NOT sent from the server. Both live in
 * `municipalityCatalog`, which is already in the bundle of every route that
 * mounts a chip cell, so shipping them again costs ~35 bytes × 435 in each RSC
 * payload. `portfolioIndexDerivations` resolves them by slug.
 */
export type MunicipalityPortfolioIndexEntry = {
  id: number
  slug: string
}

/** An index entry joined to its catalog row — what the chip logic actually needs. */
export type ResolvedPortfolioEntry = {
  id: number
  slug: string
  name: string
  city: string
  region: BahiaIdentityTerritory
}

export type MunicipalityPortfolioChip =
  | {
      kind: 'territory'
      key: string
      label: string
      territory: BahiaIdentityTerritory
      municipalityIds: number[]
    }
  | {
      /** A zone-city (Salvador) with ALL of its zones assigned — "Salvador (19)". */
      kind: 'city'
      key: string
      label: string
      city: string
      municipalityIds: number[]
    }
  | {
      kind: 'municipality'
      key: string
      label: string
      municipalityId: number
      slug: string
    }

export type MunicipalityPortfolioSearchHit =
  | {
      kind: 'municipality'
      key: string
      label: string
      municipalityId: number
    }
  | {
      kind: 'territory'
      key: string
      label: string
      territory: BahiaIdentityTerritory
      municipalityIds: number[]
      count: number
    }
  | {
      kind: 'zone'
      key: string
      label: string
      zoneNumber: number
      municipalityIds: number[]
      count: number
    }

export const catalogEntriesForTseZone = (
  zoneNumber: number,
): readonly MunicipalityCatalogEntry[] => {
  const entries: MunicipalityCatalogEntry[] = []
  for (const city of citiesForTseZone(zoneNumber)) {
    const cityEntries = municipalityCatalogEntriesForCity(city)
    const zoneScoped = cityEntries.filter(
      (entry) => entry.kind === 'zona' && entry.zoneNumber === zoneNumber,
    )
    if (zoneScoped.length > 0) {
      entries.push(...zoneScoped)
      continue
    }
    const whole = cityEntries.find((entry) => entry.kind === 'municipio')
    if (whole) entries.push(whole)
  }
  return entries
}

type PortfolioIndexDerivations = {
  byId: Map<number, ResolvedPortfolioEntry>
  idBySlug: Map<string, number>
  idsByTerritory: Map<BahiaIdentityTerritory, number[]>
  idsByCity: Map<string, number[]>
  normalizedNames: Map<number, string>
}

/**
 * Everything derivable from the index alone, computed once per index array.
 *
 * The index is one shared reference for the whole table (the RSC builds it once
 * and every row gets the same array), so a `WeakMap` keyed on it turns work that
 * was O(rows × 27 × 435) into O(435) — and survives across renders, unlike a
 * `useMemo` inside a row. It is dropped when the array is.
 */
const derivationsByIndex = new WeakMap<
  readonly MunicipalityPortfolioIndexEntry[],
  PortfolioIndexDerivations
>()

const portfolioIndexDerivations = (
  index: readonly MunicipalityPortfolioIndexEntry[],
): PortfolioIndexDerivations => {
  const cached = derivationsByIndex.get(index)
  if (cached) return cached

  const derived: PortfolioIndexDerivations = {
    byId: new Map(),
    idBySlug: new Map(),
    idsByTerritory: new Map(),
    idsByCity: new Map(),
    normalizedNames: new Map(),
  }
  for (const entry of index) {
    // A slug the catalog does not know has no name and no território, so it can
    // neither be labeled nor collapsed — dropping it is what the chip builder
    // already did with an id it could not resolve. An int test pins that the
    // seeded rows and the catalog agree, so this branch stays unreachable.
    const catalogEntry = getMunicipalityCatalogEntry(entry.slug)
    if (!catalogEntry) continue

    const resolved: ResolvedPortfolioEntry = {
      id: entry.id,
      slug: entry.slug,
      name: catalogEntry.name,
      city: catalogEntry.city,
      region: catalogEntry.region,
    }
    derived.byId.set(resolved.id, resolved)
    derived.idBySlug.set(resolved.slug, resolved.id)
    derived.normalizedNames.set(resolved.id, normalizeSearchPhrase(resolved.name))
    const territoryIds = derived.idsByTerritory.get(resolved.region)
    if (territoryIds) territoryIds.push(resolved.id)
    else derived.idsByTerritory.set(resolved.region, [resolved.id])
    const cityIds = derived.idsByCity.get(resolved.city)
    if (cityIds) cityIds.push(resolved.id)
    else derived.idsByCity.set(resolved.city, [resolved.id])
  }

  derivationsByIndex.set(index, derived)
  return derived
}

/**
 * The index an advisor's suggestions may draw from, as ONE array shared by every
 * row — a per-row `.filter()` returns a distinct array identity even when the
 * content is identical, which silently defeats the `WeakMap` above and makes each
 * searching row rebuild the same O(435) derivation. Keyed on both inputs because
 * the scope belongs to the actor, not to the index.
 */
const scopedIndexByAddableIds = new WeakMap<
  ReadonlySet<number>,
  WeakMap<readonly MunicipalityPortfolioIndexEntry[], readonly MunicipalityPortfolioIndexEntry[]>
>()

export const scopedPortfolioIndex = (
  index: readonly MunicipalityPortfolioIndexEntry[],
  addableIds: ReadonlySet<number> | undefined,
): readonly MunicipalityPortfolioIndexEntry[] => {
  if (!addableIds) return index

  let byIndex = scopedIndexByAddableIds.get(addableIds)
  if (!byIndex) {
    byIndex = new WeakMap()
    scopedIndexByAddableIds.set(addableIds, byIndex)
  }

  const cached = byIndex.get(index)
  if (cached) return cached

  const scoped = index.filter((entry) => addableIds.has(entry.id))
  byIndex.set(index, scoped)
  return scoped
}

/**
 * The index resolved against the catalog, by id — for callers that need a
 * município's name outside a chip (list filter labels). Shares the memoized
 * derivation the chips already built for the same array.
 */
export const resolvedPortfolioEntriesById = (
  index: readonly MunicipalityPortfolioIndexEntry[],
): ReadonlyMap<number, ResolvedPortfolioEntry> => portfolioIndexDerivations(index).byId

/**
 * The only slug→id resolution left in the file: the território twin it used to
 * have now reads `idsByTerritory` off the same derivation the chips collapse
 * with, so a generic `municipalityIdsForEntries` would be an abstraction with
 * one caller.
 */
const municipalityIdsForTseZone = (zoneNumber: number, idBySlug: Map<string, number>): number[] => {
  const ids: number[] = []
  for (const entry of catalogEntriesForTseZone(zoneNumber)) {
    const id = idBySlug.get(entry.slug)
    if (id !== undefined) ids.push(id)
  }
  return ids
}

/**
 * Collapse complete territory memberships into a single territory chip, and a
 * complete zone-city (all of Salvador's 19 zones) into one "Salvador (N)" chip.
 * The city group is checked FIRST: the zones share the city's territory, so
 * without it the complete set would collapse into the territory chip
 * ("Metropolitano de Salvador (19)") instead of the intended "Salvador (19)".
 *
 * Labels and slugs come from `index` — the complete catalog by construction — so
 * an id it does not know cannot be rendered (no name, no link) and is dropped
 * rather than shown as an anonymous chip.
 */
export const buildMunicipalityPortfolioChips = (
  assignedMunicipalityIds: readonly number[],
  index: readonly MunicipalityPortfolioIndexEntry[],
): MunicipalityPortfolioChip[] => {
  const { byId, idsByTerritory, idsByCity } = portfolioIndexDerivations(index)
  const remaining = new Set(assignedMunicipalityIds)
  const chips: MunicipalityPortfolioChip[] = []

  for (const city of ZONE_MUNICIPALITY_CITIES) {
    const cityIds = idsByCity.get(city)
    if (!cityIds || cityIds.length === 0) continue
    // A zone-city group never fits in fewer ids than it has (19 for Salvador).
    if (cityIds.length > remaining.size) continue
    if (!cityIds.every((id) => remaining.has(id))) continue

    chips.push({
      kind: 'city',
      key: `city:${city}`,
      label: city,
      city,
      municipalityIds: [...cityIds],
    })
    for (const id of cityIds) remaining.delete(id)
  }

  for (const territory of bahiaIdentityTerritories) {
    const territoryIds = idsByTerritory.get(territory)
    if (!territoryIds || territoryIds.length === 0) continue
    // A território never fits in fewer ids than it has; the typical leadership
    // holds 1–3 and the smallest TI ~10, so this skips all 27 without scanning.
    if (territoryIds.length > remaining.size) continue
    if (!territoryIds.every((id) => remaining.has(id))) continue

    chips.push({
      kind: 'territory',
      key: `territory:${territory}`,
      label: territory,
      territory,
      // Copied out of the derivation: that array is memoized per index and
      // shared by every row of the table, so handing it to a caller would turn
      // any later sort/splice on a chip into corruption of the whole page.
      municipalityIds: [...territoryIds],
    })
    for (const id of territoryIds) remaining.delete(id)
  }

  const leftover = [...remaining]
    .map((id) => byId.get(id))
    .filter((entry): entry is ResolvedPortfolioEntry => entry !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  for (const entry of leftover) {
    chips.push({
      kind: 'municipality',
      key: `municipality:${entry.id}`,
      label: entry.name,
      municipalityId: entry.id,
      slug: entry.slug,
    })
  }

  return chips
}

const zoneLabel = (zoneNumber: number): string => `ZE ${zoneNumber}`

/** Pure function of a frozen table: the 199 distinct ZE, with labels pre-normalized. */
const NORMALIZED_ZONE_LABELS: readonly { zoneNumber: number; normalizedLabel: string }[] = (() => {
  const zones = new Set<number>()
  for (const entry of municipalityCatalog) {
    for (const zone of entry.tseZones) zones.add(zone)
  }
  return [...zones]
    .sort((left, right) => left - right)
    .map((zoneNumber) => ({
      zoneNumber,
      normalizedLabel: normalizeSearchPhrase(zoneLabel(zoneNumber)),
    }))
})()

const NORMALIZED_TERRITORIES: readonly { territory: BahiaIdentityTerritory; normalized: string }[] =
  bahiaIdentityTerritories.map((territory) => ({
    territory,
    normalized: normalizeSearchPhrase(territory),
  }))

const queryLooksLikeZone = (normalizedQuery: string): number | null => {
  const match = normalizedQuery.match(/^(?:ze|zona)?\s*(\d{1,3})$/)
  if (!match) return null
  const zoneNumber = Number(match[1])
  return Number.isInteger(zoneNumber) && zoneNumber > 0 ? zoneNumber : null
}

export const searchMunicipalityPortfolio = (
  query: string,
  index: readonly MunicipalityPortfolioIndexEntry[],
  alreadyAssignedIds: ReadonlySet<number>,
  limit = 12,
): MunicipalityPortfolioSearchHit[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  // Normalize the query ONCE: it used to be re-normalized inside the matcher for
  // each of ~660 candidates (435 names + 27 TI + up to 199 ZE labels).
  const normalizedQuery = normalizeSearchPhrase(trimmed)
  const { byId, idBySlug, idsByTerritory, normalizedNames } = portfolioIndexDerivations(index)
  const hits: MunicipalityPortfolioSearchHit[] = []
  const zoneFromQuery = queryLooksLikeZone(normalizedQuery)

  // `byId` is built in index order, so the suggestions stay alphabetical for the
  // same reason the index is — and an entry the catalog cannot name is not here.
  for (const entry of byId.values()) {
    if (alreadyAssignedIds.has(entry.id)) continue
    if (!matchesNormalizedAtWordStart(normalizedNames.get(entry.id) ?? '', normalizedQuery))
      continue
    hits.push({
      kind: 'municipality',
      key: `municipality:${entry.id}`,
      label: entry.name,
      municipalityId: entry.id,
    })
    if (hits.length >= limit) return hits
  }

  for (const { territory, normalized } of NORMALIZED_TERRITORIES) {
    if (!matchesNormalizedAtWordStart(normalized, normalizedQuery)) continue
    // Same derivation as the chip collapse above, so a território cannot be
    // offered under one rule and fail to collapse under another.
    const municipalityIds = (idsByTerritory.get(territory) ?? []).filter(
      (id) => !alreadyAssignedIds.has(id),
    )
    if (municipalityIds.length === 0) continue
    hits.push({
      kind: 'territory',
      key: `territory:${territory}`,
      label: territory,
      territory,
      municipalityIds,
      count: municipalityIds.length,
    })
    if (hits.length >= limit) return hits
  }

  const zonesToScan =
    zoneFromQuery !== null
      ? [zoneFromQuery]
      : NORMALIZED_ZONE_LABELS.filter((zone) =>
          matchesNormalizedAtWordStart(zone.normalizedLabel, normalizedQuery),
        ).map((zone) => zone.zoneNumber)

  for (const zoneNumber of zonesToScan) {
    const municipalityIds = municipalityIdsForTseZone(zoneNumber, idBySlug).filter(
      (id) => !alreadyAssignedIds.has(id),
    )
    if (municipalityIds.length === 0) continue
    hits.push({
      kind: 'zone',
      key: `zone:${zoneNumber}`,
      label: zoneLabel(zoneNumber),
      zoneNumber,
      municipalityIds,
      count: municipalityIds.length,
    })
    if (hits.length >= limit) return hits
  }

  return hits
}

/**
 * Replace expanded batch chips (territory / zone-city) with their member
 * municipality chips, in place, keeping every other chip untouched. Pure
 * presentation: nothing here writes — the members are real municipalities, so
 * they carry the slug for the detail link and their own `ids` for removal.
 */
export const expandMunicipalityPortfolioChips = (
  chips: readonly MunicipalityPortfolioChip[],
  expandedKeys: ReadonlySet<string>,
  index: readonly MunicipalityPortfolioIndexEntry[],
): MunicipalityPortfolioChip[] => {
  if (expandedKeys.size === 0) return [...chips]
  const { byId } = portfolioIndexDerivations(index)
  return chips.flatMap((chip) => {
    if (!expandedKeys.has(chip.key)) return [chip]
    if (chip.kind !== 'territory' && chip.kind !== 'city') return [chip]
    const members: MunicipalityPortfolioChip[] = []
    for (const id of chip.municipalityIds) {
      const entry = byId.get(id)
      if (!entry) continue
      members.push({
        kind: 'municipality',
        key: `municipality:${id}`,
        label: entry.name,
        municipalityId: id,
        slug: entry.slug,
      })
    }
    return members
  })
}
