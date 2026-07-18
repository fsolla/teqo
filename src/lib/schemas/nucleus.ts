import { z } from 'zod'

import {
  bahiaIdentityTerritories,
  isBahiaMunicipality,
  validateBahiaTerritoryPair,
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

const optionalBahiaCity = trimmedOptionalText(120).refine(
  (value) => value === undefined || isBahiaMunicipality(value),
  'Selecione um município válido da Bahia.',
)

const nullableBahiaCity = trimmedNullableText(120).refine(
  (value) => value === undefined || value === null || isBahiaMunicipality(value),
  'Selecione um município válido da Bahia.',
)

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
  region: z.enum(bahiaIdentityTerritories).optional(),
  city: optionalBahiaCity,
  neighborhood: trimmedOptionalText(160),
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
  region?: (typeof bahiaIdentityTerritories)[number] | null
  city?: string | null
  neighborhood?: string | null
  locality?: string | null
  tseZones?: Array<{ zoneNumber: number }>
}

const validateTerritoryAndZones = (
  data: TerritoryValidationInput,
  context: z.RefinementCtx,
  mode: 'create' | 'patch',
) => {
  const geographyWasFullyProvided =
    data.region !== undefined && data.city !== undefined && data.locality !== undefined
  if (
    !data.region &&
    !data.city &&
    !data.locality &&
    (mode === 'create' || geographyWasFullyProvided)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Informe o território de identidade, município ou localidade do núcleo.',
      path: ['city'],
    })
  }

  const neighborhoodLacksCity =
    mode === 'create' ? !data.city : data.city === null
  if (data.neighborhood && neighborhoodLacksCity) {
    context.addIssue({
      code: 'custom',
      message: 'Informe o município antes do bairro.',
      path: ['neighborhood'],
    })
  }

  if (!validateBahiaTerritoryPair(data.region, data.city)) {
    context.addIssue({
      code: 'custom',
      message: 'O município não pertence ao território de identidade selecionado.',
      path: ['city'],
    })
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

export const nucleusUpdateSchema = nucleusFieldsSchema
  .partial()
  .extend({
    id: positiveRelationshipId,
    region: z.enum(bahiaIdentityTerritories).nullable().optional(),
    city: nullableBahiaCity,
    neighborhood: trimmedNullableText(160),
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

export type NucleusCreateInput = z.input<typeof nucleusCreateSchema>
export type NucleusUpdateInput = z.input<typeof nucleusUpdateSchema>
