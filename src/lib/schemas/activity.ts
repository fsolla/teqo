import { z } from 'zod'

import { campaignDemandCreateSchema } from '@/lib/schemas/campaignDemandInput'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

/**
 * Refusal messages matched by exact string in the routes' `safeMessages` —
 * named once (B32+/B37 contract): a reworded literal at either end silently
 * collapses the refusal into the generic error.
 */
export const ACTIVITY_TASK_NOT_FOUND_MESSAGE = 'Tarefa não encontrada.'
export const ACTIVITY_UPDATE_BODY_REQUIRED_MESSAGE = 'Informe o texto da atualização.'
export const ACTIVITY_UPDATE_BODY_TOO_LONG_MESSAGE =
  'Atualização muito longa. Reduza o texto e tente novamente.'
export const ACTIVITY_RESULT_REQUIRED_MESSAGE = 'Informe o resultado da atividade.'
export const ACTIVITY_RESULT_TOO_LONG_MESSAGE =
  'Resultado muito longo. Reduza o texto e tente novamente.'
export const ACTIVITY_RESULT_STAFF_MESSAGE =
  'Apenas a equipe da campanha pode registrar o resultado da atividade.'

/**
 * C14 — tags are free-form labels the mesa invents (comício, imprensa, etc.).
 * No rigid taxonomy; the filter is the value. Max 20 tags, 80 chars each.
 */
export const MAX_ACTIVITY_TAGS = 20
export const MAX_ACTIVITY_TAG_LENGTH = 80

export const activityStatuses = ['confirmado', 'realizado', 'cancelado'] as const
export type ActivityStatus = (typeof activityStatuses)[number]

export const activityStatusLabels: Record<ActivityStatus, string> = {
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

const MAX_ACTIVITY_ORGANIZATIONS = 20
export const MAX_ACTIVITY_DEMAND_DRAFTS = 20

const activityDemandDraftSchema = campaignDemandCreateSchema.pick({
  title: true,
  kind: true,
  description: true,
})

export const activityDemandDraftsSchema = z
  .array(activityDemandDraftSchema)
  .max(MAX_ACTIVITY_DEMAND_DRAFTS)

export type ActivityDemandDraft = z.input<typeof activityDemandDraftSchema>

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  responsible: positiveRelationshipId.optional(),
  due: z.string().datetime().optional().nullable(),
  done: z.boolean().optional(),
})

const activityTagsSchema = z
  .array(z.string().trim().min(1).max(MAX_ACTIVITY_TAG_LENGTH))
  .max(MAX_ACTIVITY_TAGS)

const activityFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  tags: activityTagsSchema.optional(),
  status: z.enum(activityStatuses).optional(),
  description: trimmedOptionalText(4000),
  deputyPresent: z.boolean().optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  municipality: positiveRelationshipId,
  locality: trimmedOptionalText(160),
  organizations: z.array(positiveRelationshipId).max(MAX_ACTIVITY_ORGANIZATIONS).optional(),
  advisors: z.array(positiveRelationshipId).optional(),
  responsible: positiveRelationshipId.optional(),
  leadership: positiveRelationshipId.optional(),
  tasks: z.array(taskSchema).optional(),
})

const validateSchedule = (
  data: {
    status?: ActivityStatus | null
    startAt?: string | null
    endAt?: string | null
  },
  context: z.RefinementCtx,
  requireStart: boolean,
) => {
  if (requireStart && !data.startAt) {
    context.addIssue({
      code: 'custom',
      message: 'Informe a data e horário de início do compromisso.',
      path: ['startAt'],
    })
  }

  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt)
    const end = new Date(data.endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(start < end)) {
      context.addIssue({
        code: 'custom',
        message: 'O horário de término deve ser posterior ao de início.',
        path: ['endAt'],
      })
    }
  }
}

export const activityCreateSchema = activityFieldsSchema
  .extend({
    status: z.enum(['confirmado']).default('confirmado'),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, true)
  })
  .transform((data) => ({
    ...data,
    endAt: data.endAt ?? undefined,
    tags: data.tags ?? [],
  }))

export const activityUpdateSchema = activityFieldsSchema
  .partial()
  .extend({
    id: positiveRelationshipId,
    locality: trimmedNullableText(160),
    description: trimmedNullableText(4000),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    responsible: positiveRelationshipId.nullable().optional(),
    leadership: positiveRelationshipId.nullable().optional(),
    status: z.enum(activityStatuses).optional(),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, true)
  })

export type ActivityCreateInput = z.input<typeof activityCreateSchema>
export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>

/**
 * E13 — one stop of a giro, as the composer submits it: which município and
 * what tags the stop generates. The title is deliberately NOT part of it: it
 * is composed on the server from the município's own name, so a client cannot
 * label a draft after a município it did not pick.
 */
const tourStopDraftSchema = activityFieldsSchema.pick({ municipality: true, tags: true })

export const tourStopDraftsSchema = z.array(tourStopDraftSchema)

export type TourStopDraft = z.infer<typeof tourStopDraftSchema>
