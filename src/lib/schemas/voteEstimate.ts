import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

const voteEstimateFieldsSchema = z.object({
  nucleus: positiveRelationshipId,
  estimate: z.number().int().nonnegative().max(100_000_000),
})

export const suggestVoteEstimateSchema = voteEstimateFieldsSchema

export const confirmVoteEstimateSchema = voteEstimateFieldsSchema.extend({
  expectedProposedVoteEstimateVersion: z.uuid().nullable(),
  confirmationNote: z
    .string()
    .trim()
    .min(3, 'Explique brevemente por que o valor foi ajustado.')
    .max(1000)
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
})

export type SuggestVoteEstimateInput = z.input<typeof suggestVoteEstimateSchema>
export type ConfirmVoteEstimateInput = z.input<typeof confirmVoteEstimateSchema>
