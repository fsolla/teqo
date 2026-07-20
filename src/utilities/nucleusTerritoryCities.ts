import { citiesForTerritory, isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'

export type NucleusTerritoryCitiesInput = {
  cities: string[]
  regions: string[]
}

const uniqueSortedCities = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, 'pt-BR'))

/** Cities explicitly set on the nucleus, or all cities from selected identity territories. */
export const resolveNucleusTerritoryCities = ({
  cities,
  regions,
}: NucleusTerritoryCitiesInput): string[] => {
  const citiesFromNucleus = uniqueSortedCities([...cities].filter((city) => city.length > 0))
  if (citiesFromNucleus.length > 0) return citiesFromNucleus

  return uniqueSortedCities(
    regions.flatMap((region) =>
      isBahiaIdentityTerritory(region) ? citiesForTerritory(region) : [],
    ),
  )
}
