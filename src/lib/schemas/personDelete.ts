import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

export const personDeleteInputSchema = z.object({
  contactId: positiveRelationshipId,
})

/**
 * Refusal messages shared verbatim between the server action (thrown) and the
 * client dialog (rendered) — the `*_MESSAGE` constant convention. Client-safe.
 */
export const PERSON_DELETE_NOT_FOUND_MESSAGE = 'Pessoa não encontrada.'
export const PERSON_DELETE_FORBIDDEN_MESSAGE =
  'Somente a coordenação e o candidato podem apagar pessoas.'
export const PERSON_DELETE_PROTECTED_ACCOUNT_MESSAGE =
  'Esta pessoa tem conta de coordenação ou candidato e não pode ser apagada.'
