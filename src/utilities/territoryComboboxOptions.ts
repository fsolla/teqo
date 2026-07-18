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

export const municipalityComboboxOptions = (region?: string | null): StrictComboboxOption[] =>
  toOptions(
    region && isBahiaIdentityTerritory(region) ? citiesForTerritory(region) : bahiaMunicipalities,
  )
