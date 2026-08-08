import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'

const MAX_CALENDAR_FEED_LABEL_LENGTH = 120

export const calendarFeedCreateSchema = z.object({
  label: z.string().trim().min(1).max(MAX_CALENDAR_FEED_LABEL_LENGTH),
  filterMunicipality: positiveRelationshipId.optional(),
  filterDeputyPresent: z.boolean().optional(),
  filterTag: z.string().trim().min(1).max(80).optional(),
})

export type CalendarFeedCreateInput = z.input<typeof calendarFeedCreateSchema>
