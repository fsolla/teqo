import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

import {
  isBahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import {
  MAX_NUCLEUS_CITIES,
  MAX_NUCLEUS_NEIGHBORHOODS,
  MAX_NUCLEUS_REGIONS,
} from '@/lib/schemas/nucleus'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const normalizeTerritoryTextArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const trimmed = typeof item === 'string' ? item.trim() : ''
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

const resolveTerritoryArray = (
  data: Record<string, unknown> | undefined,
  originalDoc: Record<string, unknown> | undefined,
  field: 'regions' | 'cities' | 'neighborhoods',
  operation: 'create' | 'update' | 'delete',
): string[] => {
  if (operation === 'update' && data && !(field in data)) {
    return normalizeTerritoryTextArray(originalDoc?.[field])
  }
  return normalizeTerritoryTextArray(data?.[field])
}

export type CampaignTerritoryValidationOptions = {
  /** Portuguese entity label used in the "require territory" error (e.g. "núcleo", "plano"). */
  entityLabel: string
}

/**
 * Shared Bahia territory validation for campaign collections that own
 * regions/cities/neighborhoods/locality/territoryNotes (núcleo, plano de ação).
 */
export const createCampaignTerritoryValidationHook = (
  options: CampaignTerritoryValidationOptions,
): CollectionBeforeValidateHook => {
  return ({ data, operation, originalDoc }) => {
    if (!data) return data

    const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
    const cities = resolveTerritoryArray(data, originalDoc, 'cities', operation)
    const neighborhoods = resolveTerritoryArray(data, originalDoc, 'neighborhoods', operation)
    let regions = resolveTerritoryArray(data, originalDoc, 'regions', operation)
    const locality = trimmedText(nextData?.locality)
    const territoryNotes = trimmedText(nextData?.territoryNotes)

    if (cities.length > MAX_NUCLEUS_CITIES) {
      throw new APIError(`Informe no máximo ${MAX_NUCLEUS_CITIES} municípios.`, 400)
    }
    if (regions.length > MAX_NUCLEUS_REGIONS) {
      throw new APIError(`Informe no máximo ${MAX_NUCLEUS_REGIONS} territórios.`, 400)
    }
    if (neighborhoods.length > MAX_NUCLEUS_NEIGHBORHOODS) {
      throw new APIError(`Informe no máximo ${MAX_NUCLEUS_NEIGHBORHOODS} bairros.`, 400)
    }

    for (const city of cities) {
      if (!isBahiaMunicipality(city)) {
        throw new APIError('Selecione um município válido da Bahia.', 400)
      }
    }

    if (cities.length > 0) {
      regions = territoriesForCities(cities)
    } else {
      for (const region of regions) {
        if (!isBahiaIdentityTerritory(region)) {
          throw new APIError('Selecione um território de identidade válido da Bahia.', 400)
        }
      }
    }

    if (neighborhoods.length > 0 && cities.length !== 1) {
      throw new APIError(
        cities.length === 0
          ? 'Informe o município antes do bairro.'
          : 'Bairros só podem ser informados quando há exatamente um município.',
        400,
      )
    }

    if (regions.length === 0 && cities.length === 0 && !locality) {
      throw new APIError(
        `Informe o território de identidade, município ou localidade do ${options.entityLabel}.`,
        400,
      )
    }

    data.regions = regions
    data.cities = cities
    data.neighborhoods = cities.length === 1 ? neighborhoods : []
    data.locality = locality || null
    data.territoryNotes = territoryNotes || null

    return data
  }
}
