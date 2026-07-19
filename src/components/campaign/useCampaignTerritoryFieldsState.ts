'use client'

import { useMemo, useState } from 'react'

import { territoriesForCities } from '@/lib/bahiaTerritories'
import {
  dedupeTrimmedStrings,
  MAX_NUCLEUS_CITIES,
  MAX_NUCLEUS_NEIGHBORHOODS,
  MAX_NUCLEUS_REGIONS,
} from '@/lib/schemas/nucleus'
import {
  allMunicipalityComboboxOptions,
  territoryComboboxOptions,
} from '@/utilities/territoryComboboxOptions'

export type CampaignTerritoryValues = {
  regions?: string[] | null
  cities?: string[] | null
  neighborhoods?: string[] | null
}

export const useCampaignTerritoryFieldsState = (values?: CampaignTerritoryValues) => {
  const [regions, setRegions] = useState(() => dedupeTrimmedStrings(values?.regions ?? []))
  const [cities, setCities] = useState(() => dedupeTrimmedStrings(values?.cities ?? []))
  const [neighborhoods, setNeighborhoods] = useState(() =>
    dedupeTrimmedStrings(values?.neighborhoods ?? []),
  )
  const [cityDraft, setCityDraft] = useState('')
  const [regionDraft, setRegionDraft] = useState('')
  const [neighborhoodDraft, setNeighborhoodDraft] = useState('')
  const [regionError, setRegionError] = useState<string>()
  const [cityError, setCityError] = useState<string>()
  const [neighborhoodError, setNeighborhoodError] = useState<string>()

  const derivedRegions = useMemo(() => territoriesForCities(cities), [cities])
  const displayRegions = cities.length > 0 ? derivedRegions : regions
  const regionsAreDerived = cities.length > 0
  const neighborhoodsEnabled = cities.length === 1

  const availableCityOptions = useMemo(() => {
    const selected = new Set(cities)
    return allMunicipalityComboboxOptions.filter((option) => !selected.has(option.value))
  }, [cities])
  const availableRegionOptions = useMemo(() => {
    const selected = new Set(regions)
    return territoryComboboxOptions.filter((option) => !selected.has(option.value))
  }, [regions])

  const addCity = (nextCity: string) => {
    if (!nextCity) return
    if (cities.length >= MAX_NUCLEUS_CITIES) {
      setCityError(`Informe no máximo ${MAX_NUCLEUS_CITIES} municípios.`)
      setCityDraft('')
      return
    }
    setCities((current) => {
      const next = dedupeTrimmedStrings([...current, nextCity])
      if (next.length !== 1) setNeighborhoods([])
      return next
    })
    setCityDraft('')
    setCityError(undefined)
    setRegionError(undefined)
  }

  const removeCity = (city: string) => {
    setCities((current) => {
      const next = current.filter((item) => item !== city)
      if (next.length !== 1) setNeighborhoods([])
      return next
    })
    setCityError(undefined)
  }

  const addRegion = (nextRegion: string) => {
    if (!nextRegion || regionsAreDerived) return
    if (regions.length >= MAX_NUCLEUS_REGIONS) {
      setRegionError(`Informe no máximo ${MAX_NUCLEUS_REGIONS} territórios.`)
      setRegionDraft('')
      return
    }
    setRegions((current) => dedupeTrimmedStrings([...current, nextRegion]))
    setRegionDraft('')
    setRegionError(undefined)
  }

  const removeRegion = (region: string) => {
    if (regionsAreDerived) return
    setRegions((current) => current.filter((item) => item !== region))
    setRegionError(undefined)
  }

  const commitNeighborhood = (value: string) => {
    if (!neighborhoodsEnabled) {
      setNeighborhoodDraft('')
      return
    }
    const trimmed = value.trim()
    if (!trimmed) {
      setNeighborhoodDraft('')
      return
    }
    if (neighborhoods.length >= MAX_NUCLEUS_NEIGHBORHOODS) {
      setNeighborhoodError(`Informe no máximo ${MAX_NUCLEUS_NEIGHBORHOODS} bairros.`)
      setNeighborhoodDraft('')
      return
    }
    setNeighborhoods((current) => dedupeTrimmedStrings([...current, trimmed]))
    setNeighborhoodDraft('')
    setNeighborhoodError(undefined)
  }

  const removeNeighborhood = (neighborhood: string) => {
    setNeighborhoods((current) => current.filter((item) => item !== neighborhood))
  }

  return {
    regions,
    cities,
    neighborhoods,
    cityDraft,
    regionDraft,
    neighborhoodDraft,
    regionError,
    cityError,
    neighborhoodError,
    setCityDraft,
    setRegionDraft,
    setNeighborhoodDraft,
    setRegionError,
    setCityError,
    setNeighborhoodError,
    displayRegions,
    regionsAreDerived,
    neighborhoodsEnabled,
    availableCityOptions,
    availableRegionOptions,
    addCity,
    removeCity,
    addRegion,
    removeRegion,
    commitNeighborhood,
    removeNeighborhood,
  }
}

export type CampaignTerritoryFieldsState = ReturnType<typeof useCampaignTerritoryFieldsState>
