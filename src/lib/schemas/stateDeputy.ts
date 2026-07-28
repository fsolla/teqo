import { z } from 'zod'

import { MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE } from '@/lib/schemas/municipality'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const stateDeputyCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  party: trimmedOptionalText(32),
  notes: trimmedOptionalText(4000),
})

export const stateDeputyUpdateSchema = z.object({
  id: positiveRelationshipId,
  party: trimmedNullableText(32),
  notes: trimmedNullableText(4000),
})

export const STATE_DEPUTY_MUNICIPALITIES_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria gerenciam dobradinhas.'

/**
 * Delta write for the "Municípios" column of `/campanha/dobradinhas` (B37) —
 * adds or removes a set of municipalities (one chip, or a whole território/ZE)
 * on `municipality.stateDeputies` — the inverted side of the relation this
 * `stateDeputy` sits on. `municipalityIds.max(435)` is the universe of
 * municípios in one batch call (a whole território), not the per-município
 * cap on dobradinhas, which lives in `MAX_STATE_DEPUTIES_PER_MUNICIPALITY`.
 */
export const stateDeputyMunicipalitiesBatchSchema = z.object({
  stateDeputyId: positiveRelationshipId,
  municipalityIds: z
    .array(positiveRelationshipId)
    .min(1)
    .max(435)
    .transform((ids) => [...new Set(ids)]),
  assigned: z.boolean(),
})

export const STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES = [
  STATE_DEPUTY_MUNICIPALITIES_STAFF_MESSAGE,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
] as const

export type StateDeputyCreateInput = z.input<typeof stateDeputyCreateSchema>
export type StateDeputyUpdateInput = z.input<typeof stateDeputyUpdateSchema>
export type StateDeputyMunicipalitiesBatchInput = z.input<
  typeof stateDeputyMunicipalitiesBatchSchema
>
