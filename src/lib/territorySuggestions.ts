import {
  citiesForTerritory,
  isBahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'
import {
  citiesForTseZone,
  tseZonesForCity,
  tseZonesForTerritory,
} from '@/lib/bahiaTseZones'
import { MAX_NUCLEUS_CITIES } from '@/lib/schemas/nucleus'
import { sortedUniqueZoneNumbers } from '@/utilities/tseZone'

export type ZoneSuggestion = {
  kind: 'city' | 'territory'
  label: string
  zonesToAdd: number[]
}

export type CitySuggestion = {
  kind: 'sibling' | 'zone'
  city: string
}

export type TerritorySuggestionInput = {
  cities: readonly string[]
  regions: readonly string[]
  tseZones: readonly number[]
}

export type TerritorySuggestions = {
  zoneSuggestions: ZoneSuggestion[]
  citySuggestions: CitySuggestion[]
  /** Zones present in the form that are outside the official city/TI set. Empty when no geography. */
  outsideZones: number[]
}

const missingZones = (official: readonly number[], current: ReadonlySet<number>): number[] =>
  official.filter((zone) => !current.has(zone))

const comparePtBr = (left: string, right: string) => left.localeCompare(right, 'pt-BR')

/**
 * Pure suggestion engine for opt-in territory ↔ TSE zone chips.
 * Returns only what is still missing; never auto-applies.
 */
export const buildTerritorySuggestions = ({
  cities,
  regions,
  tseZones,
}: TerritorySuggestionInput): TerritorySuggestions => {
  const citySet = new Set(cities)
  const zoneSet = new Set(tseZones)
  const displayRegions = regions.filter(isBahiaIdentityTerritory)
  const official = new Set<number>()

  const zoneSuggestions: ZoneSuggestion[] = []

  for (const city of cities) {
    const cityZones = tseZonesForCity(city)
    for (const zone of cityZones) official.add(zone)
    const zonesToAdd = missingZones(cityZones, zoneSet)
    if (zonesToAdd.length === 0) continue
    zoneSuggestions.push({ kind: 'city', label: city, zonesToAdd })
  }

  for (const territory of displayRegions) {
    const territoryZones = tseZonesForTerritory(territory)
    for (const zone of territoryZones) official.add(zone)
    const zonesToAdd = missingZones(territoryZones, zoneSet)
    if (zonesToAdd.length === 0) continue
    zoneSuggestions.push({ kind: 'territory', label: territory, zonesToAdd })
  }

  const cityByName = new Map<string, CitySuggestion>()

  if (cities.length < MAX_NUCLEUS_CITIES) {
    for (const territory of displayRegions) {
      for (const city of citiesForTerritory(territory)) {
        if (citySet.has(city) || cityByName.has(city)) continue
        cityByName.set(city, { kind: 'sibling', city })
      }
    }

    for (const zoneNumber of tseZones) {
      for (const city of citiesForTseZone(zoneNumber)) {
        if (citySet.has(city) || cityByName.has(city)) continue
        // Prefer sibling when both TI and zone sources suggest the same city
        // (siblings are inserted first above).
        cityByName.set(city, { kind: 'zone', city })
      }
    }
  }

  return {
    zoneSuggestions: [...zoneSuggestions].sort((left, right) =>
      comparePtBr(left.label, right.label),
    ),
    citySuggestions: [...cityByName.values()].sort((left, right) =>
      comparePtBr(left.city, right.city),
    ),
    outsideZones:
      official.size === 0
        ? []
        : sortedUniqueZoneNumbers(tseZones.filter((zone) => !official.has(zone))),
  }
}
