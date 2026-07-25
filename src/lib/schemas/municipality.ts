import { z } from 'zod'

import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'
import { voteEstimateScenarioFieldsSchema } from '@/lib/schemas/votePledge'

export const politicalTrendStatuses = ['favoravel', 'neutra', 'desfavoravel'] as const
export type PoliticalTrendStatusValue = (typeof politicalTrendStatuses)[number]

const stateDeputiesArraySchema = z
  .array(positiveRelationshipId)
  .max(20)
  .transform((ids) => [...new Set(ids)])

export const municipalityStrategyUpdateSchema = z.object({
  municipality: positiveRelationshipId,
  priority: z.enum(['alta', 'normal']).optional(),
  strengths: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  risks: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  stateDeputies: stateDeputiesArraySchema.optional(),
  dobradinhaNotes: trimmedNullableText(4000),
  nextSteps: trimmedNullableText(4000),
  budgetNotes: trimmedNullableText(4000),
})

export const municipalityPoliticalTrendSchema = z.object({
  municipality: positiveRelationshipId,
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

export const municipalityAdvisorsAssignmentSchema = z.object({
  municipality: positiveRelationshipId,
  advisors: z
    .array(positiveRelationshipId)
    .max(10)
    .transform((ids) => [...new Set(ids)]),
})

export const municipalityExpectedVotesSchema = z.object({
  municipality: positiveRelationshipId,
  expectedVotes: voteEstimateScenarioFieldsSchema,
})

export type MunicipalityStrategyUpdateInput = z.input<typeof municipalityStrategyUpdateSchema>
export type MunicipalityPoliticalTrendInput = z.input<typeof municipalityPoliticalTrendSchema>
export type MunicipalityAdvisorsAssignmentInput = z.input<typeof municipalityAdvisorsAssignmentSchema>
export type MunicipalityExpectedVotesInput = z.input<typeof municipalityExpectedVotesSchema>
