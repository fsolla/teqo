import { z } from 'zod'

import {
  MAX_MUNICIPALITIES_PER_BATCH,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/municipality'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'
import { parseStateDeputyNameParty } from '@/lib/stateDeputyNameParty'

export const stateDeputyCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  party: trimmedOptionalText(32),
  ballotName: trimmedOptionalText(30),
  notes: trimmedOptionalText(4000),
})

export const stateDeputyUpdateSchema = z.object({
  id: positiveRelationshipId,
  party: trimmedNullableText(32),
  ballotName: trimmedNullableText(30),
  notes: trimmedNullableText(4000),
})

export const stateDeputyPartyUpdateSchema = z.object({
  id: positiveRelationshipId,
  party: trimmedNullableText(32),
})

/** C129 — delta write for the "Nome de legenda" column of `/campanha/dobradinhas`. */
export const stateDeputyBallotNameUpdateSchema = z.object({
  id: positiveRelationshipId,
  ballotName: trimmedNullableText(30),
})

export const STATE_DEPUTY_INVALID_CONTACT_MESSAGE = 'Contato da dobradinha inválido.'
export const STATE_DEPUTY_INVALID_FIELD_MESSAGE = 'Campo de dobradinha inválido.'

/**
 * Refused staff-only write on any dobradinha — thrown by the create/update
 * policy AND by the município batch. Named once because every route's
 * `safeMessages` matches it by exact string: a reworded literal in one of the
 * four places it used to live would have silently become the generic error.
 */
export const STATE_DEPUTY_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria gerenciam dobradinhas.'

/** Same exact-string contract as above, shared by the policy and the create route. */
export const STATE_DEPUTY_CONFLICT_MESSAGE = 'Já existe uma dobradinha com este nome.'

/**
 * B157 — thrown by `setCanonicalStateDeputySlug` when a name slugifies empty;
 * safelisted by the inline-create route (a "Criar …" query of only punctuation
 * must not collapse into the generic message).
 */
export const STATE_DEPUTY_NAME_REQUIRED_MESSAGE = 'Informe um nome com letras ou números.'

/**
 * Delta write for the "Municípios" column of `/campanha/dobradinhas` (B37) —
 * adds or removes a set of municipalities (one chip, or a whole território/ZE)
 * on `municipality.stateDeputies` — the inverted side of the relation this
 * `stateDeputy` sits on. The bound is the universe of municípios in one batch
 * call (a whole território), not the per-município cap on dobradinhas, which
 * lives in `MAX_STATE_DEPUTIES_PER_MUNICIPALITY`.
 */
export const stateDeputyMunicipalitiesBatchSchema = z.object({
  stateDeputyId: positiveRelationshipId,
  municipalityIds: z
    .array(positiveRelationshipId)
    .min(1)
    .max(MAX_MUNICIPALITIES_PER_BATCH)
    .transform((ids) => [...new Set(ids)]),
  assigned: z.boolean(),
})

export const STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES = [
  STATE_DEPUTY_STAFF_MESSAGE,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
] as const

/**
 * B157 — inline create from the municípios list ("Criar dobradinha 'texto'"):
 * the raw search text is split by `parseStateDeputyNameParty`, so a trailing
 * `(PARTIDO)` becomes the party and the rest the name. The pipe re-validates
 * AFTER the split — a name that only parses to empty (e.g. "(PT)") is refused
 * instead of minting a deputy named "(PT)".
 */
export const municipalityStateDeputyCreateSchema = z
  .object({
    municipalityId: positiveRelationshipId,
    rawName: z.string().min(1).max(200),
  })
  .transform((input) => {
    const { name, party } = parseStateDeputyNameParty(input.rawName)
    return { municipalityId: input.municipalityId, name, party }
  })
  .refine((value) => value.name.length >= 2 && value.name.length <= 120, {
    message: 'O nome precisa ter entre 2 e 120 caracteres.',
  })
  .refine((value) => (value.party ?? '').length <= 32, {
    message: 'O partido pode ter no máximo 32 caracteres.',
  })

/**
 * Cap for `StateDeputy.advisors` (B156) — mirrors `MAX_ADVISORS_PER_MUNICIPALITY`:
 * a dobradinha has a handful of responsible advisors, and every bounded
 * relation in `/campanha` carries a cap so `nextIdsAfterMembership` can refuse
 * with a spoken reason before the optimistic apply.
 */
export const MAX_ADVISORS_PER_STATE_DEPUTY = 10

export const STATE_DEPUTY_ADVISORS_CAP_MESSAGE = `Cada dobradinha aceita no máximo ${MAX_ADVISORS_PER_STATE_DEPUTY} assessores.`

export const STATE_DEPUTY_ADVISORS_UNRESTRICTED_MESSAGE =
  'Somente a coordenação geral ou o candidato gerencia assessores de dobradinhas.'

/**
 * Delta write for the "Assessores" column/section of a dobradinha (B156) —
 * one chip toggle on `StateDeputy.advisors`, the owning document (no batch:
 * the relation lives on the dobradinha itself).
 */
export const stateDeputyAdvisorMembershipSchema = z.object({
  stateDeputyId: positiveRelationshipId,
  advisorId: positiveRelationshipId,
  assigned: z.boolean(),
})

export const STATE_DEPUTY_ADVISOR_SAFE_MESSAGES = [
  STATE_DEPUTY_ADVISORS_UNRESTRICTED_MESSAGE,
  STATE_DEPUTY_ADVISORS_CAP_MESSAGE,
] as const

export type StateDeputyCreateInput = z.input<typeof stateDeputyCreateSchema>
export type StateDeputyUpdateInput = z.input<typeof stateDeputyUpdateSchema>
export type StateDeputyPartyUpdateInput = z.input<typeof stateDeputyPartyUpdateSchema>
export type StateDeputyBallotNameUpdateInput = z.input<typeof stateDeputyBallotNameUpdateSchema>
export type StateDeputyMunicipalitiesBatchInput = z.input<
  typeof stateDeputyMunicipalitiesBatchSchema
>
export type MunicipalityStateDeputyCreateInput = z.input<typeof municipalityStateDeputyCreateSchema>
export type StateDeputyAdvisorMembershipInput = z.input<typeof stateDeputyAdvisorMembershipSchema>
