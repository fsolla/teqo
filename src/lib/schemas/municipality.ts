import { z } from 'zod'

import { ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH, engagementLevels } from '@/lib/engagementLevel'
import {
  advisorNameSchema,
  positiveRelationshipId,
  trimmedNullableText,
} from '@/lib/schemas/primitives'
import { voteEstimateScenarioFieldsSchema } from '@/lib/schemas/votePledge'

export const politicalTrendStatuses = ['favoravel', 'neutra', 'desfavoravel'] as const
export type PoliticalTrendStatusValue = (typeof politicalTrendStatuses)[number]

/**
 * Anti-payload bound, not a domain rule: `municipality.stateDeputies` has no
 * product-level ceiling (a município can be dobrado with any number of
 * deputados), and the catalog itself caps out at 435. Named so the chip-batch
 * write (B37) and this whole-array strategy update stay on the same number —
 * they parse through the same schema, and a batch write that pushed past a
 * lower bound would leave the strategy ficha unsavable on its next submit.
 */
export const MAX_STATE_DEPUTIES_PER_MUNICIPALITY = 435

/**
 * Anti-payload bound on a batch that names many municípios at once (a whole
 * território/ZE): the catalog is 435 rows and ids are unique, so this is the
 * whole universe and not a product rule. Named because both município-side
 * batch schemas (`advisor`, `stateDeputy`) were carrying a bare `435`.
 */
export const MAX_MUNICIPALITIES_PER_BATCH = 435

export const MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE = `Cada município aceita no máximo ${MAX_STATE_DEPUTIES_PER_MUNICIPALITY} dobradinhas.`

const stateDeputiesArraySchema = z
  .array(positiveRelationshipId)
  .max(MAX_STATE_DEPUTIES_PER_MUNICIPALITY)
  .transform((ids) => [...new Set(ids)])

export const municipalityStrategyUpdateSchema = z.object({
  municipality: positiveRelationshipId,
  priority: z.enum(['alta', 'normal']).optional(),
  strengths: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  risks: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  stateDeputies: stateDeputiesArraySchema.optional(),
  dobradinhaNotes: trimmedNullableText(4000),
  nextSteps: trimmedNullableText(4000),
  budgetNotes: trimmedNullableText(4000),
})

export const municipalityPoliticalTrendSchema = z.object({
  municipality: positiveRelationshipId,
  status: z.enum(politicalTrendStatuses).nullable(),
  note: trimmedNullableText(2000),
})

export const parsePoliticalTrendStatusFormValue = (
  raw: string | undefined,
): PoliticalTrendStatusValue | null => {
  if (!raw) return null
  return politicalTrendStatuses.includes(raw as PoliticalTrendStatusValue)
    ? (raw as PoliticalTrendStatusValue)
    : null
}

export const MAX_ADVISORS_PER_MUNICIPALITY = 10

export const MUNICIPALITY_ADVISORS_CAP_MESSAGE = `Cada município aceita no máximo ${MAX_ADVISORS_PER_MUNICIPALITY} assessores.`

export const municipalityAdvisorsAssignmentSchema = z.object({
  municipality: positiveRelationshipId,
  advisors: z
    .array(positiveRelationshipId)
    .max(MAX_ADVISORS_PER_MUNICIPALITY)
    .transform((ids) => [...new Set(ids)]),
})

/** Single-toggle delta from the list popover — one advisor at a time, never the whole array. */
export const municipalityAdvisorMembershipSchema = z.object({
  municipality: positiveRelationshipId,
  advisor: positiveRelationshipId,
  assigned: z.boolean(),
})

/**
 * B154 — inline create from the list popover: name-only account (`advisor`
 * role, stub e-mail) assigned to the município in the same write. The name
 * rule is the shared `advisorNameSchema` from the leaf primitives module —
 * `schemas/advisor.ts` already imports from this one, so the reverse import
 * would close a cycle.
 */
export const municipalityAdvisorCreateSchema = z.object({
  municipality: positiveRelationshipId,
  name: advisorNameSchema,
})

export const MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE =
  'Somente a coordenação geral ou o candidato designa assessores.'

export const MUNICIPALITY_ADVISOR_MEMBERSHIP_SAFE_MESSAGES = [
  MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
] as const

/**
 * B154 — internal failure of the deterministic stub probe (the bounded loop
 * found no free `<slug>@criado.invalid` e-mail). Not safelisted: it collapses
 * to the route's generic message, exactly as an unexpected unique violation
 * would.
 */
export const MUNICIPALITY_ADVISOR_STUB_EMAIL_MESSAGE =
  'Não foi possível gerar um e-mail placeholder único para o assessor.'

export const MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE =
  'Somente a coordenação geral ou o candidato move o nível de envolvimento.'

/**
 * E14 — a movement records the new level plus an optional motivo; hysteresis,
 * triangulated shock and override stay on the write path (B134).
 */
export const municipalityEngagementLevelSchema = z.object({
  municipality: positiveRelationshipId,
  level: z.enum(engagementLevels),
  note: trimmedNullableText(ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH),
  /** Licenses a two-level jump (research §6.8). */
  triangulatedShock: z.boolean().default(false),
  /** Accepts the listed violations knowingly; recorded in the decision snapshot. */
  override: z.boolean().default(false),
})

export const municipalityExpectedVotesSchema = z.object({
  municipality: positiveRelationshipId,
  expectedVotes: voteEstimateScenarioFieldsSchema,
})

export type MunicipalityStrategyUpdateInput = z.input<typeof municipalityStrategyUpdateSchema>
export type MunicipalityPoliticalTrendInput = z.input<typeof municipalityPoliticalTrendSchema>
export type MunicipalityAdvisorsAssignmentInput = z.input<
  typeof municipalityAdvisorsAssignmentSchema
>
export type MunicipalityAdvisorMembershipInput = z.input<typeof municipalityAdvisorMembershipSchema>
export type MunicipalityAdvisorCreateInput = z.input<typeof municipalityAdvisorCreateSchema>
export type MunicipalityExpectedVotesInput = z.input<typeof municipalityExpectedVotesSchema>
export type MunicipalityEngagementLevelInput = z.input<typeof municipalityEngagementLevelSchema>
