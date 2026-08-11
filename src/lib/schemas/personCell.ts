import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

/**
 * C116 — cell-edit contracts of `/campanha/pessoas`: per-field Contact writes
 * (via the shared `contactFieldUpdateSchema`), the Assessora carteira batch
 * (unrestricted-only, person with exactly ONE staff account) and the
 * person-centric Assessorado advisor delta.
 */

export const personAssessoraMembershipSchema = z.object({
  contactId: positiveRelationshipId,
  municipalityIds: z.array(positiveRelationshipId).min(1),
  assigned: z.boolean(),
})

export const personAdvisorMembershipSchema = z.object({
  contactId: positiveRelationshipId,
  advisorId: positiveRelationshipId,
  assigned: z.boolean(),
})

export type PersonAssessoraMembershipInput = z.input<typeof personAssessoraMembershipSchema>
export type PersonAdvisorMembershipInput = z.input<typeof personAdvisorMembershipSchema>

/** Refusal messages shared verbatim between the server action and the cell. */
export const PERSON_CELL_STAFF_MESSAGE =
  'Somente a coordenação e o candidato podem editar essa pessoa.'
export const PERSON_CELL_NOT_IN_SCOPE_MESSAGE = 'Esta pessoa não está no seu escopo de edição.'
export const PERSON_CONTACT_INVALID_MESSAGE = 'Esta pessoa não tem ficha de contato.'
export const PERSON_ASSESSORA_UNRESTRICTED_MESSAGE =
  'Somente a coordenação e o candidato podem editar a carteira de assessores.'
export const PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE =
  'Esta pessoa não tem perfil de assessor para vincular municípios.'
export const PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE =
  'Esta pessoa tem mais de um perfil de assessor; edite os municípios por perfil no admin.'
export const PERSON_ADVISORS_UNRESTRICTED_MESSAGE =
  'Somente a coordenação e o candidato podem editar os assessores.'
