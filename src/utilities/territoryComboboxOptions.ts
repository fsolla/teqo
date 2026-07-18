import {
  bahiaIdentityTerritories,
  bahiaMunicipalities,
  citiesForTerritory,
  isBahiaIdentityTerritory,
} from '@/lib/bahiaTerritories'

export type StrictComboboxOption = {
  label: string
  value: string
}

const toOptions = (values: readonly string[]): StrictComboboxOption[] =>
  values.map((value) => ({ label: value, value }))

export const territoryComboboxOptions = toOptions(bahiaIdentityTerritories)

/** Full Bahia municipality list — stable module reference for client filters. */
export const allMunicipalityComboboxOptions = toOptions(bahiaMunicipalities)

export const municipalityComboboxOptions = (region?: string | null): StrictComboboxOption[] =>
  region && isBahiaIdentityTerritory(region)
    ? toOptions(citiesForTerritory(region))
    : allMunicipalityComboboxOptions
