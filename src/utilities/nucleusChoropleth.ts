import { codeForMunicipality } from '@/lib/bahiaMunicipalityCodes'
import {
  bahiaIdentityTerritoryRecords,
  isBahiaIdentityTerritory,
  territoryForCity,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import { resolveNucleusElectionGeography, type NucleusElectionGeographyInput } from '@/utilities/nucleusElectoralBaseline'
import {
  emptyNucleusChoroplethBundle,
  type ChoroplethMetric,
  type ChoroplethValues,
  type NucleusChoroplethBundle,
  type NucleusChoroplethNucleus,
} from '@/utilities/nucleusChoroplethTypes'

export type {
  ChoroplethMetric,
  ChoroplethValues,
  NucleusChoroplethBundle,
  NucleusChoroplethNucleus,
} from '@/utilities/nucleusChoroplethTypes'
export { choroplethMetricLabels, emptyNucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

const territoryCodeByName = new Map(
  bahiaIdentityTerritoryRecords.map((record) => [record.name, record.code]),
)

type ResolvedChoroplethNucleus = {
  nucleus: NucleusChoroplethNucleus
  cities: string[]
  territoryCodes: string[]
}

const emptyMetricValues = (): Record<ChoroplethMetric, ChoroplethValues> => ({
  ...emptyNucleusChoroplethBundle().municipality,
})

const addToRecord = (record: ChoroplethValues, key: string, amount: number) => {
  record[key] = (record[key] ?? 0) + amount
}

export const codareasForCities = (cities: readonly string[]): string[] => [
  ...new Set(
    cities.flatMap((city) => {
      const codarea = codeForMunicipality(city)
      return codarea ? [codarea] : []
    }),
  ),
]

export const territoryCodesForNucleus = (
  nucleus: Pick<NucleusChoroplethNucleus, 'cities' | 'regions'>,
): string[] => {
  const fromRegions = nucleus.regions.flatMap((region) => {
    if (!isBahiaIdentityTerritory(region)) return []
    const code = territoryCodeByName.get(region)
    return code ? [code] : []
  })
  if (fromRegions.length > 0) return [...new Set(fromRegions)]

  return territoriesForCities(nucleus.cities).flatMap((name) => {
    const code = territoryCodeByName.get(name)
    return code ? [code] : []
  })
}

const effectiveCitiesForNucleus = (nucleus: NucleusElectionGeographyInput): string[] => {
  const geography = resolveNucleusElectionGeography(nucleus)
  return geography ? [...geography.zonesByCity.keys()] : []
}

export const resolveChoroplethNuclei = (
  nuclei: readonly NucleusChoroplethNucleus[],
): ResolvedChoroplethNucleus[] =>
  nuclei.map((nucleus) => ({
    nucleus,
    cities: effectiveCitiesForNucleus(nucleus),
    territoryCodes: territoryCodesForNucleus(nucleus),
  }))

const uniqueCitiesFromResolved = (resolved: readonly ResolvedChoroplethNucleus[]): string[] => {
  const cities = new Set<string>()
  for (const { cities: nucleusCities } of resolved) {
    for (const city of nucleusCities) {
      cities.add(city)
    }
  }
  return [...cities]
}

export const buildNucleusDetailMapHighlight = (
  nucleus: NucleusElectionGeographyInput,
): { codareas: string[]; territoryCodes: string[] } => {
  const cities = effectiveCitiesForNucleus(nucleus)
  return {
    codareas: codareasForCities(cities),
    territoryCodes: territoryCodesForNucleus(nucleus),
  }
}

export const choroplethCityNames = (nuclei: readonly NucleusChoroplethNucleus[]): string[] =>
  uniqueCitiesFromResolved(resolveChoroplethNuclei(nuclei))

export const buildNucleusChoroplethBundleFromResolved = (
  resolved: readonly ResolvedChoroplethNucleus[],
  baselineVotesByCity: ReadonlyMap<string, number> = new Map(),
): NucleusChoroplethBundle => {
  const municipality = emptyMetricValues()
  const territory = emptyMetricValues()

  for (const { nucleus, cities, territoryCodes } of resolved) {
    if (cities.length > 0) {
      const cityShare =
        nucleus.confirmedVoteEstimate != null ? nucleus.confirmedVoteEstimate / cities.length : 0

      for (const city of cities) {
        const codarea = codeForMunicipality(city)
        if (!codarea) continue
        addToRecord(municipality.nucleusCount, codarea, 1)
        if (nucleus.confirmedVoteEstimate != null) {
          addToRecord(municipality.confirmedEstimate, codarea, cityShare)
        }
      }
    }

    if (territoryCodes.length > 0) {
      const territoryShare =
        nucleus.confirmedVoteEstimate != null
          ? nucleus.confirmedVoteEstimate / territoryCodes.length
          : 0

      for (const code of territoryCodes) {
        addToRecord(territory.nucleusCount, code, 1)
        if (nucleus.confirmedVoteEstimate != null) {
          addToRecord(territory.confirmedEstimate, code, territoryShare)
        }
      }
    }
  }

  for (const city of uniqueCitiesFromResolved(resolved)) {
    const baselineVotes = baselineVotesByCity.get(city) ?? 0
    if (baselineVotes <= 0) continue

    const codarea = codeForMunicipality(city)
    if (codarea) {
      addToRecord(municipality.baseline2022Votes, codarea, baselineVotes)
    }

    const territoryName = territoryForCity(city)
    const territoryCode = territoryName ? territoryCodeByName.get(territoryName) : undefined
    if (territoryCode) {
      addToRecord(territory.baseline2022Votes, territoryCode, baselineVotes)
    }
  }

  return { municipality, territory }
}

export const buildNucleusChoroplethBundle = (
  nuclei: readonly NucleusChoroplethNucleus[],
  baselineVotesByCity: ReadonlyMap<string, number> = new Map(),
): NucleusChoroplethBundle =>
  buildNucleusChoroplethBundleFromResolved(resolveChoroplethNuclei(nuclei), baselineVotesByCity)
