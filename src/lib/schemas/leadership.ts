import { z } from 'zod'

import {
  brazilianMobile,
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const leadershipGenders = ['feminino', 'masculino', 'outro', 'nao_informado'] as const

export const leadershipSectors = [
  'religioso',
  'sindical',
  'comunitario',
  'rural',
  'empresarial',
  'juventude',
  'saude',
  'educacao',
  'cultura',
  'outro',
] as const

export const leadershipSupportStatuses = [
  'engajado',
  'a_abordar',
  'em_disputa',
  'negativo',
] as const

export type SupportStatus = (typeof leadershipSupportStatuses)[number]

export const isSupportStatus = (value: unknown): value is SupportStatus =>
  typeof value === 'string' && leadershipSupportStatuses.some((status) => status === value)

export const MAX_LEADERSHIP_MUNICIPALITIES = 30
export const MAX_LEADERSHIP_ORGANIZATIONS = 20
export const MAX_LEADERSHIP_STATE_DEPUTIES = 20

const municipalitiesArraySchema = z
  .array(positiveRelationshipId)
  .min(1, 'Vincule a liderança a pelo menos um município.')
  .max(MAX_LEADERSHIP_MUNICIPALITIES)
  .transform((ids) => [...new Set(ids)])

const organizationsArraySchema = z
  .array(positiveRelationshipId)
  .max(MAX_LEADERSHIP_ORGANIZATIONS)
  .transform((ids) => [...new Set(ids)])

const stateDeputiesArraySchema = z
  .array(positiveRelationshipId)
  .max(MAX_LEADERSHIP_STATE_DEPUTIES)
  .transform((ids) => [...new Set(ids)])

export const leadershipCreateSchema = z.object({
  municipalities: municipalitiesArraySchema,
  organizations: organizationsArraySchema.optional(),
  stateDeputies: stateDeputiesArraySchema.optional(),
  name: z.string().trim().min(2).max(120),
  phone: brazilianMobile,
  email: optionalPersistedEmail,
  gender: z.enum(leadershipGenders).optional(),
  sector: z.enum(leadershipSectors).optional(),
  sectorNotes: trimmedOptionalText(1000),
  supportStatus: z.enum(leadershipSupportStatuses).default('a_abordar'),
  notes: trimmedOptionalText(3000),
  consentNote: trimmedOptionalText(2000),
})

export const leadershipInternalUpdateSchema = z.object({
  id: positiveRelationshipId,
  municipalities: municipalitiesArraySchema.optional(),
  organizations: organizationsArraySchema.nullable().optional(),
  stateDeputies: stateDeputiesArraySchema.nullable().optional(),
  sector: z.enum(leadershipSectors).nullable().optional(),
  sectorNotes: trimmedNullableText(1000),
  supportStatus: z.enum(leadershipSupportStatuses).optional(),
  notes: trimmedNullableText(3000),
  consentNote: trimmedNullableText(2000),
})

export type LeadershipCreateInput = z.input<typeof leadershipCreateSchema>
export type LeadershipInternalUpdateInput = z.input<typeof leadershipInternalUpdateSchema>
