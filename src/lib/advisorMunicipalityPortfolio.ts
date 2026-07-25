import {
  bahiaIdentityTerritories,
  type BahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'
import {
  municipalityCatalog,
  municipalityCatalogEntriesForCity,
  type MunicipalityCatalogEntry,
} from '@/lib/municipalityCatalog'
import { citiesForTseZone } from '@/lib/bahiaTseZones'
import { matchesAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'

export type AdvisorMunicipalityIndexEntry = {
  id: number
  name: string
  slug: string
  region: BahiaIdentityTerritory
  city: string
  zoneNumber: number | null
}

export type AdvisorPortfolioChip =
  | {
      kind: 'territory'
      key: string
      label: string
      territory: BahiaIdentityTerritory
      municipalityIds: number[]
    }
  | {
      kind: 'municipality'
      key: string
      label: string
      municipalityId: number
      slug: string
    }

export type AdvisorPortfolioSearchHit =
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

const catalogEntriesForTerritory = (
  territory: BahiaIdentityTerritory,
): readonly MunicipalityCatalogEntry[] =>
  municipalityCatalog.filter((entry) => entry.region === territory)

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

const indexBySlug = (
  entries: readonly AdvisorMunicipalityIndexEntry[],
): Map<string, AdvisorMunicipalityIndexEntry> =>
  new Map(entries.map((entry) => [entry.slug, entry]))

const municipalityIdsForTerritory = (
  territory: BahiaIdentityTerritory,
  bySlug: Map<string, AdvisorMunicipalityIndexEntry>,
): number[] => {
  const ids: number[] = []
  for (const entry of catalogEntriesForTerritory(territory)) {
    const resolved = bySlug.get(entry.slug)
    if (resolved) ids.push(resolved.id)
  }
  return ids
}

const municipalityIdsForTseZone = (
  zoneNumber: number,
  bySlug: Map<string, AdvisorMunicipalityIndexEntry>,
): number[] => {
  const ids: number[] = []
  for (const entry of catalogEntriesForTseZone(zoneNumber)) {
    const resolved = bySlug.get(entry.slug)
    if (resolved) ids.push(resolved.id)
  }
  return ids
}

/** Collapse complete territory memberships into a single territory chip. */
export const buildAdvisorPortfolioChips = (
  assignedMunicipalities: readonly { id: number; name: string; slug: string }[],
  index: readonly AdvisorMunicipalityIndexEntry[],
): AdvisorPortfolioChip[] => {
  const byId = new Map(index.map((entry) => [entry.id, entry]))
  const assigned = new Map(assignedMunicipalities.map((municipality) => [municipality.id, municipality]))
  const remaining = new Set(assigned.keys())
  const chips: AdvisorPortfolioChip[] = []

  // Prefer the live index's `region` (DB) over catalog→slug resolution so chips
  // collapse even when slug casing/alias differs across environments.
  for (const territory of bahiaIdentityTerritories) {
    const territoryIds = index.filter((entry) => entry.region === territory).map((entry) => entry.id)
    if (territoryIds.length === 0) continue
    if (!territoryIds.every((id) => remaining.has(id))) continue

    chips.push({
      kind: 'territory',
      key: `territory:${territory}`,
      label: territory,
      territory,
      municipalityIds: territoryIds,
    })
    for (const id of territoryIds) remaining.delete(id)
  }

  const leftover = [...remaining]
    .map((id) => assigned.get(id))
    .filter((municipality): municipality is { id: number; name: string; slug: string } =>
      Boolean(municipality),
    )
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  for (const municipality of leftover) {
    const indexed = byId.get(municipality.id)
    chips.push({
      kind: 'municipality',
      key: `municipality:${municipality.id}`,
      label: municipality.name,
      municipalityId: municipality.id,
      slug: indexed?.slug ?? municipality.slug,
    })
  }

  return chips
}

const uniqueZoneNumbers = (): number[] => {
  const zones = new Set<number>()
  for (const entry of municipalityCatalog) {
    for (const zone of entry.tseZones) zones.add(zone)
  }
  return [...zones].sort((left, right) => left - right)
}

const zoneLabel = (zoneNumber: number): string => `ZE ${zoneNumber}`

const queryLooksLikeZone = (query: string): number | null => {
  const normalized = normalizeSearchPhrase(query)
  const match = normalized.match(/^(?:ze|zona)?\s*(\d{1,3})$/)
  if (!match) return null
  const zoneNumber = Number(match[1])
  return Number.isInteger(zoneNumber) && zoneNumber > 0 ? zoneNumber : null
}

export const searchAdvisorPortfolio = (
  query: string,
  index: readonly AdvisorMunicipalityIndexEntry[],
  alreadyAssignedIds: ReadonlySet<number>,
  limit = 12,
): AdvisorPortfolioSearchHit[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  const bySlug = indexBySlug(index)
  const hits: AdvisorPortfolioSearchHit[] = []
  const zoneFromQuery = queryLooksLikeZone(trimmed)

  for (const entry of index) {
    if (alreadyAssignedIds.has(entry.id)) continue
    if (!matchesAtWordStart(entry.name, trimmed)) continue
    hits.push({
      kind: 'municipality',
      key: `municipality:${entry.id}`,
      label: entry.name,
      municipalityId: entry.id,
    })
    if (hits.length >= limit) return hits
  }

  for (const territory of bahiaIdentityTerritories) {
    if (!matchesAtWordStart(territory, trimmed)) continue
    const municipalityIds = municipalityIdsForTerritory(territory, bySlug).filter(
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
      : uniqueZoneNumbers().filter((zoneNumber) => matchesAtWordStart(zoneLabel(zoneNumber), trimmed))

  for (const zoneNumber of zonesToScan) {
    const municipalityIds = municipalityIdsForTseZone(zoneNumber, bySlug).filter(
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
