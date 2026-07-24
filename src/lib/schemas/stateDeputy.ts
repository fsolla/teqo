import { z } from 'zod'

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

export type StateDeputyCreateInput = z.input<typeof stateDeputyCreateSchema>
export type StateDeputyUpdateInput = z.input<typeof stateDeputyUpdateSchema>
