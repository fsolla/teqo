import { z } from 'zod'

import { contactFieldUpdateSchema, contactPhonesSchema } from '@/lib/schemas/contact'
import {
  optionalPersistedEmail,
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const leadershipGenders = ['feminino', 'masculino', 'outro', 'nao_informado'] as const

export const leadershipSupportStatuses = [
  'engajado',
  'a_abordar',
  'em_disputa',
  'lembranca',
  'negativo',
] as const

export type SupportStatus = (typeof leadershipSupportStatuses)[number]

export const isSupportStatus = (value: unknown): value is SupportStatus =>
  typeof value === 'string' && leadershipSupportStatuses.some((status) => status === value)

export const MAX_LEADERSHIP_MUNICIPALITIES = 30
const MAX_LEADERSHIP_ORGANIZATIONS = 20
export const MAX_LEADERSHIP_STATE_DEPUTIES = 20
export const MAX_LEADERSHIP_ADVISORS = 10

export const LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE =
  'Vincule a liderança a pelo menos um município.'

export const LEADERSHIP_MUNICIPALITY_CAP_MESSAGE = `Cada liderança aceita no máximo ${MAX_LEADERSHIP_MUNICIPALITIES} municípios.`

/** Thrown by the chip toggle on both sides of the relation (B31/B36), so both routes allowlist it. */
export const LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE = `Cada liderança aceita no máximo ${MAX_LEADERSHIP_STATE_DEPUTIES} dobradinhas.`

/** Thrown by the assessor toggle on the leadership detail (C99), same allowlist contract. */
export const LEADERSHIP_ADVISORS_CAP_MESSAGE = `Cada liderança aceita no máximo ${MAX_LEADERSHIP_ADVISORS} assessores responsáveis.`

export const LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE =
  'Somente a coordenação geral ou o candidato gerencia assessores de lideranças.'

/**
 * Delta write for the "Assessores responsáveis" section of a liderança (C99) —
 * one chip toggle on `Leadership.advisors`, the owning document (no batch:
 * the relation lives on the leadership itself, mirror of
 * `stateDeputyAdvisorMembershipSchema`).
 */
export const leadershipAdvisorMembershipSchema = z.object({
  leadershipId: positiveRelationshipId,
  advisorId: positiveRelationshipId,
  assigned: z.boolean(),
})

export type LeadershipAdvisorMembershipInput = z.input<typeof leadershipAdvisorMembershipSchema>

/** Thrown by the actions and matched verbatim by every route's `safeMessages`. */
export const LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE =
  'Você só pode vincular lideranças aos municípios que assessora.'

/** Same exact-string contract: the staff gate of every leadership write. */
export const LEADERSHIP_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria podem gerenciar lideranças.'

/** Same exact-string contract: one ficha per person (`contact` UNIQUE). */
export const LEADERSHIP_DUPLICATE_MESSAGE =
  'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novos municípios.'

export const LEADERSHIP_INVALID_CONTACT_MESSAGE = 'Contato da liderança inválido.'

const municipalitiesArraySchema = z
  .array(positiveRelationshipId)
  .min(1, LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE)
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
  phones: contactPhonesSchema.min(1, 'Informe ao menos um celular.'),
  email: optionalPersistedEmail,
  gender: z.enum(leadershipGenders).optional(),
  exclusive: z.boolean().default(true),
  supportStatus: z.enum(leadershipSupportStatuses).default('a_abordar'),
  notes: trimmedOptionalText(3000),
})

export const leadershipInternalUpdateSchema = z.object({
  id: positiveRelationshipId,
  municipalities: municipalitiesArraySchema.optional(),
  organizations: organizationsArraySchema.nullable().optional(),
  stateDeputies: stateDeputiesArraySchema.nullable().optional(),
  exclusive: z.boolean().optional(),
  supportStatus: z.enum(leadershipSupportStatuses).optional(),
  notes: trimmedNullableText(3000),
})

export type LeadershipInternalUpdateInput = z.input<typeof leadershipInternalUpdateSchema>

const leadershipWizardFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phones: contactPhonesSchema.min(1, 'Informe ao menos um celular.'),
  email: optionalPersistedEmail,
  exclusive: z.boolean().default(true),
  supportStatus: z.enum(leadershipSupportStatuses).default('a_abordar'),
  notes: trimmedOptionalText(3000),
})

export const leadershipWizardCreateSchema = leadershipWizardFieldsSchema.extend({
  municipalityId: positiveRelationshipId,
})

/**
 * B155 — inline create from the "Lideranças" column of `/campanha/municipios`:
 * name only, linked to the município whose popover created it. Strict
 * so the toggle shape (`leadershipId`/`assigned`) can never slip through.
 */
export const municipalityLeadershipCreateSchema = z.strictObject({
  municipalityId: positiveRelationshipId,
  name: z.string().trim().min(2).max(120),
})

export type MunicipalityLeadershipCreateInput = z.input<typeof municipalityLeadershipCreateSchema>

export const leadershipWizardUpdateSchema = leadershipWizardFieldsSchema.extend({
  id: positiveRelationshipId,
})

export type LeadershipWizardCreateInput = z.input<typeof leadershipWizardCreateSchema>
export type LeadershipWizardUpdateInput = z.input<typeof leadershipWizardUpdateSchema>

/** Delta write for one chip in the "Dobradinhas" column of `/campanha/liderancas` (B31). */
export const leadershipStateDeputyMembershipSchema = z.object({
  leadershipId: positiveRelationshipId,
  stateDeputyId: positiveRelationshipId,
  assigned: z.boolean(),
})

export type LeadershipStateDeputyMembershipInput = z.input<
  typeof leadershipStateDeputyMembershipSchema
>

/**
 * Delta writes for the "Municípios" column of `/campanha/liderancas` (B34).
 * The batch variant carries a whole território/ZE, so the cap is the schema's
 * own ceiling; the floor of one município is enforced against the *resulting*
 * array by `nextMunicipalityIdsAfterLeadershipMembership`, not here.
 */
export const leadershipMunicipalitiesMembershipSchema = z.object({
  leadershipId: positiveRelationshipId,
  municipalityIds: z
    .array(positiveRelationshipId)
    .min(1)
    .max(MAX_LEADERSHIP_MUNICIPALITIES)
    .transform((ids) => [...new Set(ids)]),
  assigned: z.boolean(),
})

export type LeadershipMunicipalitiesMembershipInput = z.input<
  typeof leadershipMunicipalitiesMembershipSchema
>

/** Per-field Contact write for B153 inline edit (lista + detalhe). */
export const leadershipContactUpdateSchema = contactFieldUpdateSchema

export type LeadershipContactUpdateInput = z.input<typeof leadershipContactUpdateSchema>
