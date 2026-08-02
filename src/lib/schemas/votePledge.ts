import { z } from 'zod'

import { OPS_UPDATED_AT_CONFLICT_MESSAGE, optionalBaseUpdatedAtSchema } from '@/lib/schemas/opsCas'
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
  /**
   * OH10 CAS opt-in on the pledge row's `updatedAt`. Absent → last-write-wins.
   * When no pledge exists yet, pass `null` to assert a create.
   */
  baseUpdatedAt: optionalBaseUpdatedAtSchema,
})

/** Staff record their internal estimate for one pledge. */
export const estimateVotesSchema = z.object({
  pledge: positiveRelationshipId,
  estimatedVotes: voteEstimateScenarioFieldsSchema,
  estimateNote: trimmedNullableText(1000),
  /**
   * OH6 CAS opt-in. Absent → last-write-wins (legacy). Present (including
   * `null`) → refuse when the row's `estimatedAt` differs.
   */
  baseEstimatedAt: z.string().datetime().nullable().optional(),
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

/**
 * OH6 — CAS conflict. Exact match for `safeMessages`; outbox may append a
 * second line with the server's `estimatedAt` (see `opsEstimateConflictError`).
 */
export const OPS_ESTIMATE_CONFLICT_MESSAGE =
  'Esta estimativa foi alterada por outra pessoa. Escolha manter a sua ou usar a nova.'

export const opsEstimateConflictError = (serverEstimatedAt: string | null): Error =>
  new Error(
    serverEstimatedAt == null
      ? OPS_ESTIMATE_CONFLICT_MESSAGE
      : `${OPS_ESTIMATE_CONFLICT_MESSAGE}\n${serverEstimatedAt}`,
  )

export const isOpsEstimateConflictMessage = (message: string): boolean =>
  message === OPS_ESTIMATE_CONFLICT_MESSAGE ||
  message.startsWith(`${OPS_ESTIMATE_CONFLICT_MESSAGE}\n`)

export const parseOpsEstimateConflictServerEstimatedAt = (message: string): string | null => {
  if (!isOpsEstimateConflictMessage(message)) return null
  if (message === OPS_ESTIMATE_CONFLICT_MESSAGE) return null
  const stamped = message.slice(OPS_ESTIMATE_CONFLICT_MESSAGE.length + 1)
  return stamped === '' ? null : stamped
}

export const VOTE_PLEDGE_DECLARE_SAFE_MESSAGES = [
  VOTE_PLEDGE_DECLARE_STAFF_MESSAGE,
  VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE,
  VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE,
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
] as const

export type DeclareVotesInput = z.input<typeof declareVotesSchema>
export type EstimateVotesInput = z.input<typeof estimateVotesSchema>
