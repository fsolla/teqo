import { z } from 'zod'

import {
  isBahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const organizationKinds = [
  'territorial',
  'associacao',
  'sindicato',
  'religioso',
  'movimento',
  'categoria_profissional',
  'outro',
] as const

export const sectorKinds = [
  'rural',
  'religioso',
  'sindical',
  'empresarial',
  'juventude',
  'saude',
  'educacao',
  'cultura',
  'outro',
] as const

export const MAX_NUCLEUS_REGIONS = 27
export const MAX_NUCLEUS_CITIES = 27
export const MAX_NUCLEUS_NEIGHBORHOODS = 30

export const dedupeTrimmedStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

const regionsArraySchema = z
  .array(z.string())
  .max(MAX_NUCLEUS_REGIONS)
  .transform(dedupeTrimmedStrings)
  .superRefine((regions, context) => {
    for (const [index, region] of regions.entries()) {
      if (!isBahiaIdentityTerritory(region)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um território de identidade válido da Bahia.',
          path: [index],
        })
      }
    }
  })

const citiesArraySchema = z
  .array(z.string())
  .max(MAX_NUCLEUS_CITIES)
  .transform(dedupeTrimmedStrings)
  .superRefine((cities, context) => {
    for (const [index, city] of cities.entries()) {
      if (city.length > 120 || !isBahiaMunicipality(city)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um município válido da Bahia.',
          path: [index],
        })
      }
    }
  })

const neighborhoodsArraySchema = z
  .array(z.string().max(160))
  .max(MAX_NUCLEUS_NEIGHBORHOODS)
  .transform(dedupeTrimmedStrings)

const tseZoneSchema = z.object({
  zoneNumber: z.number().int().min(1).max(999),
  label: trimmedOptionalText(160),
})

const voterProfileSchema = z.object({
  label: z.string().trim().min(1).max(120),
  ageRange: trimmedOptionalText(80),
  incomeBand: trimmedOptionalText(80),
  occupation: trimmedOptionalText(120),
  localTraits: trimmedOptionalText(500),
  notes: trimmedOptionalText(1000),
})

const insightSchema = z.object({
  text: z.string().trim().min(1).max(1000),
})

const ticketAllianceSchema = z.object({
  partnerName: trimmedOptionalText(120),
  office: trimmedOptionalText(120),
  isCampaignPartner: z.boolean().optional(),
  notes: trimmedOptionalText(1000),
})

const nucleusFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  regions: regionsArraySchema.optional(),
  cities: citiesArraySchema.optional(),
  neighborhoods: neighborhoodsArraySchema.optional(),
  locality: trimmedOptionalText(160),
  territoryNotes: trimmedOptionalText(2000),
  organizationKind: z.enum(organizationKinds),
  organizationLabel: trimmedOptionalText(160),
  sectorKind: z.enum(sectorKinds).optional(),
  tseZones: z.array(tseZoneSchema).max(999).optional(),
  primaryContact: positiveRelationshipId.optional(),
  voterProfiles: z.array(voterProfileSchema).optional(),
  strengths: z.array(insightSchema).optional(),
  risks: z.array(insightSchema).optional(),
  ticketAlliance: ticketAllianceSchema.optional(),
})

type TerritoryValidationInput = {
  regions?: string[] | null
  cities?: string[] | null
  neighborhoods?: string[] | null
  locality?: string | null
  tseZones?: Array<{ zoneNumber: number }>
}

const validateTerritoryAndZones = (
  data: TerritoryValidationInput,
  context: z.RefinementCtx,
  mode: 'create' | 'patch',
) => {
  const regions = data.regions ?? []
  const cities = data.cities ?? []
  const neighborhoods = data.neighborhoods ?? []
  const locality = data.locality ?? undefined

  const geographyWasFullyProvided =
    data.regions !== undefined && data.cities !== undefined && data.locality !== undefined
  if (
    regions.length === 0 &&
    cities.length === 0 &&
    !locality &&
    (mode === 'create' || geographyWasFullyProvided)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Informe o território de identidade, município ou localidade do núcleo.',
      path: ['cities'],
    })
  }

  if (neighborhoods.length > 0 && cities.length !== 1) {
    context.addIssue({
      code: 'custom',
      message:
        cities.length === 0
          ? 'Informe o município antes do bairro.'
          : 'Bairros só podem ser informados quando há exatamente um município.',
      path: ['neighborhoods'],
    })
  }

  if (cities.length > 0) {
    for (const city of cities) {
      if (!isBahiaMunicipality(city)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um município válido da Bahia.',
          path: ['cities'],
        })
        break
      }
    }
  } else {
    for (const region of regions) {
      if (!isBahiaIdentityTerritory(region)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um território de identidade válido da Bahia.',
          path: ['regions'],
        })
        break
      }
    }
  }

  const zoneNumbers = data.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? []
  if (new Set(zoneNumbers).size !== zoneNumbers.length) {
    context.addIssue({
      code: 'custom',
      message: 'Cada Zona TSE deve aparecer apenas uma vez.',
      path: ['tseZones'],
    })
  }
}

export const nucleusCreateSchema = nucleusFieldsSchema
  .extend({
    coordinators: z.array(positiveRelationshipId).optional(),
    organizationKind: z.enum(organizationKinds).default('territorial'),
  })
  .superRefine((data, context) => validateTerritoryAndZones(data, context, 'create'))
  .transform((data) => {
    const cities = data.cities ?? []
    const regions =
      cities.length > 0 ? territoriesForCities(cities) : (data.regions ?? []).filter(isBahiaIdentityTerritory)
    const neighborhoods = cities.length === 1 ? (data.neighborhoods ?? []) : []
    return {
      ...data,
      regions,
      cities,
      neighborhoods,
    }
  })

export const nucleusUpdateSchema = nucleusFieldsSchema
  .partial()
  .extend({
    id: positiveRelationshipId,
    regions: regionsArraySchema.nullable().optional(),
    cities: citiesArraySchema.nullable().optional(),
    neighborhoods: neighborhoodsArraySchema.nullable().optional(),
    locality: trimmedNullableText(160),
    territoryNotes: trimmedNullableText(2000),
    organizationLabel: trimmedNullableText(160),
    sectorKind: z.enum(sectorKinds).nullable().optional(),
    primaryContact: positiveRelationshipId.nullable().optional(),
    ticketAlliance: z
      .object({
        partnerName: trimmedNullableText(120),
        office: trimmedNullableText(120),
        isCampaignPartner: z.boolean().optional(),
        notes: trimmedNullableText(1000),
      })
      .optional(),
  })
  .superRefine((data, context) => validateTerritoryAndZones(data, context, 'patch'))
  .transform((data) => {
    const cities = data.cities === undefined ? undefined : (data.cities ?? [])
    const neighborhoods =
      data.neighborhoods === undefined
        ? undefined
        : cities !== undefined && cities.length !== 1
          ? []
          : (data.neighborhoods ?? [])
    const regions =
      cities === undefined
        ? data.regions === undefined
          ? undefined
          : (data.regions ?? []).filter(isBahiaIdentityTerritory)
        : cities.length > 0
          ? territoriesForCities(cities)
          : data.regions === undefined
            ? []
            : (data.regions ?? []).filter(isBahiaIdentityTerritory)

    return {
      ...data,
      ...(regions !== undefined ? { regions } : {}),
      ...(cities !== undefined ? { cities } : {}),
      ...(neighborhoods !== undefined ? { neighborhoods } : {}),
    }
  })

export type NucleusCreateInput = z.input<typeof nucleusCreateSchema>
export type NucleusUpdateInput = z.input<typeof nucleusUpdateSchema>
