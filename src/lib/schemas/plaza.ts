import { z } from 'zod'

import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'
import { voteEstimateScenarioFieldsSchema } from '@/lib/schemas/votePledge'

export const politicalTrendStatuses = ['favoravel', 'neutra', 'desfavoravel'] as const
export type PoliticalTrendStatusValue = (typeof politicalTrendStatuses)[number]

const optionalGoal = z.number().int().min(0).nullable().optional()

export const plazaStrategyUpdateSchema = z.object({
  plaza: positiveRelationshipId,
  priority: z.enum(['alta', 'normal']).optional(),
  voteGoals: z
    .object({
      good: optionalGoal,
      regular: optionalGoal,
      minimum: optionalGoal,
    })
    .optional(),
  strengths: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  risks: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  dobradinhaNotes: trimmedNullableText(4000),
  nextSteps: trimmedNullableText(4000),
})

export const plazaPoliticalTrendSchema = z.object({
  plaza: positiveRelationshipId,
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

export const plazaAdvisorsAssignmentSchema = z.object({
  plaza: positiveRelationshipId,
  advisors: z
    .array(positiveRelationshipId)
    .max(10)
    .transform((ids) => [...new Set(ids)]),
})

export const plazaExpectedVotesSchema = z.object({
  plaza: positiveRelationshipId,
  expectedVotes: voteEstimateScenarioFieldsSchema,
})

export type PlazaStrategyUpdateInput = z.input<typeof plazaStrategyUpdateSchema>
export type PlazaPoliticalTrendInput = z.input<typeof plazaPoliticalTrendSchema>
export type PlazaAdvisorsAssignmentInput = z.input<typeof plazaAdvisorsAssignmentSchema>
export type PlazaExpectedVotesInput = z.input<typeof plazaExpectedVotesSchema>
