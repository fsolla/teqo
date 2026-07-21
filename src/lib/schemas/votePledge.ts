import { z } from 'zod'

import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'

/** A leader (or staff on their behalf) declares votes for one linked plaza. */
export const declareVotesSchema = z.object({
  plaza: positiveRelationshipId,
  /** Required for staff; ignored for leaders (own leadership is derived). */
  leadership: positiveRelationshipId.optional(),
  declaredVotes: z.number().int().min(0).max(1_000_000),
})

/** Staff record their internal estimate for one pledge. */
export const estimateVotesSchema = z.object({
  pledge: positiveRelationshipId,
  estimatedVotes: z.number().int().min(0).max(1_000_000).nullable(),
  estimateNote: trimmedNullableText(1000),
})

export type DeclareVotesInput = z.input<typeof declareVotesSchema>
export type EstimateVotesInput = z.input<typeof estimateVotesSchema>
