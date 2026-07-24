import { z } from 'zod'

import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'
import {
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
} from '@/utilities/voteEstimate'

const optionalEstimate = z.number().int().min(0).max(1_000_000).nullable().optional()

export const voteEstimateScenarioFieldsSchema = z
  .object({
    pessimistic: optionalEstimate,
    central: optionalEstimate,
    optimistic: optionalEstimate,
  })
  .superRefine((value, ctx) => {
    const violation = getVoteEstimateOrderViolation(value)
    if (violation) {
      ctx.addIssue({
        code: 'custom',
        message: VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
        path: [violation],
      })
    }
  })

/** Staff declare votes on behalf of a linked leadership in one municipality. */
export const declareVotesSchema = z.object({
  municipality: positiveRelationshipId,
  leadership: positiveRelationshipId,
  declaredVotes: z.number().int().min(0).max(1_000_000),
})

/** Staff record their internal estimate for one pledge. */
export const estimateVotesSchema = z.object({
  pledge: positiveRelationshipId,
  estimatedVotes: voteEstimateScenarioFieldsSchema,
  estimateNote: trimmedNullableText(1000),
})

export type DeclareVotesInput = z.input<typeof declareVotesSchema>
export type EstimateVotesInput = z.input<typeof estimateVotesSchema>
