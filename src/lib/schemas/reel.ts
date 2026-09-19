import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

/** The communication vertical refused the actor — the reel library's own literal. */
export const REEL_FORBIDDEN_MESSAGE = 'Você não tem acesso à biblioteca de reels.'

/** The reel does not exist (or the actor cannot read it). */
export const REEL_NOT_FOUND_MESSAGE = 'Reel não encontrado.'

/** Transport/storage failure (or anything unmapped). */
export const REEL_GENERIC_ERROR_MESSAGE =
  'Não foi possível atualizar a publicação. Verifique seu acesso e tente novamente.'

/** C194 — the kill switch body: which reel and where it should land. */
export const reelPublicationRequestSchema = z.object({
  reelId: positiveRelationshipId,
  published: z.boolean(),
})

export type ReelPublicationRequest = z.infer<typeof reelPublicationRequestSchema>
