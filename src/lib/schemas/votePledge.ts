import { z } from 'zod'

import {
  MAX_VOTE_COUNT,
  positiveRelationshipId,
  trimmedNullableText,
} from '@/lib/schemas/primitives'
import {
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
} from '@/lib/voteEstimate'

const optionalEstimate = z.number().int().min(0).max(MAX_VOTE_COUNT).nullable().optional()

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
  declaredVotes: z.number().int().min(0).max(MAX_VOTE_COUNT),
})

/** Staff record their internal estimate for one pledge. */
export const estimateVotesSchema = z.object({
  pledge: positiveRelationshipId,
  estimatedVotes: voteEstimateScenarioFieldsSchema,
  estimateNote: trimmedNullableText(1000),
})

/**
 * Refusal messages matched by exact string in the routes' `safeMessages` —
 * same exact-string contract as `STATE_DEPUTY_STAFF_MESSAGE`: a literal at
 * either end is one reword away from silently collapsing into the generic
 * error, so the conventions spec bans literals at both ends.
 */
export const VOTE_PLEDGE_DECLARE_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria registram votos declarados.'
export const VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE = 'Informe a liderança da declaração.'
export const VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE =
  'A liderança precisa estar vinculada ao município para registrar votos declarados nele.'
export const VOTE_PLEDGE_ESTIMATE_STAFF_MESSAGE =
  'Somente a coordenação, a assessoria e o candidato registram estimativas.'

export const VOTE_PLEDGE_DECLARE_SAFE_MESSAGES = [
  VOTE_PLEDGE_DECLARE_STAFF_MESSAGE,
  VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE,
  VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE,
] as const

export type DeclareVotesInput = z.input<typeof declareVotesSchema>
export type EstimateVotesInput = z.input<typeof estimateVotesSchema>
