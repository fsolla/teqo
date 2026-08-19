import { z } from 'zod'

import { allDayRangeValid } from '@/lib/activityAllDay'
import { relationshipId } from '@/lib/relationship'
import { CAMPAIGN_DEMAND_BODY_MAX_LENGTH, campaignDemandKinds } from '@/lib/schemas/campaignDemand'
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
export const ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE =
  'Apenas o Coordenador Geral ou o Candidato podem remarcar compromisso com deputado presente.'
export const ACTIVITY_RESCHEDULE_FAILED_MESSAGE =
  'Não foi possível remarcar a atividade. O horário anterior foi mantido.'
export const ACTIVITY_OUT_OF_SCOPE_MESSAGE =
  'O município escolhido está fora do seu escopo de edição. Atualize a página e tente novamente.'

/**
 * C14 — tags are free-form labels the mesa invents (comício, imprensa, etc.).
 * No rigid taxonomy; the filter is the value. Max 20 tags, 80 chars each.
 */
export const MAX_ACTIVITY_TAGS = 20
export const MAX_ACTIVITY_TAG_LENGTH = 80
export const ACTIVITY_AGENDA_MAX_RANGE_DAYS = 45

export const activityStatuses = ['confirmado', 'realizado', 'cancelado'] as const
export type ActivityStatus = (typeof activityStatuses)[number]

export const activityStatusLabels: Record<ActivityStatus, string> = {
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

const MAX_ACTIVITY_ORGANIZATIONS = 20
export const MAX_ACTIVITY_DEMAND_DRAFTS = 20

/** C90 — cap for the polymorphic multi-value `responsible` field. */
export const MAX_ACTIVITY_RESPONSIBLES = 20

/**
 * Draft demand born with an activity (C90). Kept as the legacy title + free
 * text shape: the activity vertical is out of B195 scope, and its draft
 * titles are staff-curated short names, not AI-derived ones.
 */
const activityDemandDraftSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(campaignDemandKinds),
  description: trimmedOptionalText(CAMPAIGN_DEMAND_BODY_MAX_LENGTH),
})

export const activityDemandDraftsSchema = z
  .array(activityDemandDraftSchema)
  .max(MAX_ACTIVITY_DEMAND_DRAFTS)

export type ActivityDemandDraft = z.input<typeof activityDemandDraftSchema>

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  responsible: positiveRelationshipId.optional(),
  done: z.boolean().optional(),
})

const activityTagsSchema = z
  .array(z.string().trim().min(1).max(MAX_ACTIVITY_TAG_LENGTH))
  .max(MAX_ACTIVITY_TAGS)

const activityResponsibleCollections = ['campaignUser', 'leadership', 'stateDeputy'] as const
export type ActivityResponsibleCollection = (typeof activityResponsibleCollections)[number]

export const activityResponsibleTypeLabels: Record<ActivityResponsibleCollection, string> = {
  campaignUser: 'Equipe',
  leadership: 'Liderança',
  stateDeputy: 'Dobradinha',
}

export type ActivityResponsibleEntry = {
  relationTo: ActivityResponsibleCollection
  value: number
}

/**
 * Normalizes a polymorphic `responsible` value (ids or `{relationTo, value}`
 * objects at any depth) into typed entries, dropping malformed rows. Shared by
 * the collection validation, the notification recipients and the view models —
 * one place to add a future responsible kind.
 */
export const parseActivityResponsibleEntries = (value: unknown): ActivityResponsibleEntry[] =>
  (Array.isArray(value) ? value : [])
    .map((entry): ActivityResponsibleEntry | null => {
      if (typeof entry !== 'object' || entry === null) return null
      const record = entry as { relationTo?: unknown; value?: unknown }
      const relationTo = activityResponsibleCollections.find(
        (candidate) => candidate === record.relationTo,
      )
      if (!relationTo) return null
      const id = relationshipId(record.value)
      return id === null ? null : { relationTo, value: id }
    })
    .filter((entry): entry is ActivityResponsibleEntry => entry !== null)

/**
 * C90 — one typed responsible entry. `value` must be a positive id and the
 * `relationTo` one of the allowed collections; the collection hook re-verifies
 * the entity exists / stays eligible.
 */
export const activityResponsibleSchema = z.object({
  relationTo: z.enum(activityResponsibleCollections),
  value: positiveRelationshipId,
})

const activityResponsiblesSchema = z.array(activityResponsibleSchema).max(MAX_ACTIVITY_RESPONSIBLES)

const activityFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  tags: activityTagsSchema.optional(),
  status: z.enum(activityStatuses).optional(),
  description: trimmedOptionalText(4000),
  deputyPresent: z.boolean().optional(),
  allDay: z.boolean().optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  municipality: positiveRelationshipId,
  locality: trimmedOptionalText(160),
  organizations: z.array(positiveRelationshipId).max(MAX_ACTIVITY_ORGANIZATIONS).optional(),
  responsible: activityResponsiblesSchema.optional(),
  tasks: z.array(taskSchema).optional(),
})

const validateSchedule = (
  data: {
    status?: ActivityStatus | null
    allDay?: boolean | null
    startAt?: string | null
    endAt?: string | null
  },
  context: z.RefinementCtx,
  requireStart: boolean,
) => {
  if (requireStart && !data.startAt) {
    context.addIssue({
      code: 'custom',
      message: data.allDay
        ? 'Informe a data de início do compromisso.'
        : 'Informe a data e horário de início do compromisso.',
      path: ['startAt'],
    })
  }

  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt)
    const end = new Date(data.endAt)
    const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
    if (valid && data.allDay) {
      // C104 — all-day ranges are day granularity: the end date may equal the
      // start date (single-day commitment), never precede it.
      if (!allDayRangeValid(data.startAt, data.endAt)) {
        context.addIssue({
          code: 'custom',
          message: 'A data de término deve ser igual ou posterior à de início.',
          path: ['endAt'],
        })
      }
    } else if (!valid || !(start < end)) {
      context.addIssue({
        code: 'custom',
        message: 'O horário de término deve ser posterior ao de início.',
        path: ['endAt'],
      })
    }
  }
}

const isoInstantSchema = z.string().datetime({ offset: true })

export const activityAgendaRequestSchema = z
  .object({
    rangeStart: isoInstantSchema,
    rangeEnd: isoInstantSchema,
    municipality: positiveRelationshipId.optional(),
    deputyPresent: z.literal(true).optional(),
    tag: z.string().trim().min(1).max(MAX_ACTIVITY_TAG_LENGTH).optional(),
  })
  .superRefine((data, context) => {
    const start = new Date(data.rangeStart)
    const end = new Date(data.rangeEnd)
    const duration = end.getTime() - start.getTime()
    const maximumDuration = ACTIVITY_AGENDA_MAX_RANGE_DAYS * 86_400_000

    if (!(duration > 0) || duration > maximumDuration) {
      context.addIssue({
        code: 'custom',
        message: `Consulte no máximo ${ACTIVITY_AGENDA_MAX_RANGE_DAYS} dias da agenda por vez.`,
        path: ['rangeEnd'],
      })
    }
  })
  .transform((data) => ({
    ...data,
    rangeStart: new Date(data.rangeStart).toISOString(),
    rangeEnd: new Date(data.rangeEnd).toISOString(),
  }))

export const activityRescheduleSchema = z
  .object({
    id: positiveRelationshipId,
    // C104 — the agenda knows the event's all-day state; the client converts
    // FullCalendar's exclusive end into the stored inclusive convention and
    // sends ready instants. allDay only relaxes the ordering rule here.
    allDay: z.boolean(),
    startAt: isoInstantSchema,
    endAt: isoInstantSchema.nullable(),
  })
  .superRefine((data, context) => {
    if (data.allDay) {
      if (!data.endAt) {
        context.addIssue({
          code: 'custom',
          message: 'Informe a data de término do compromisso de dia inteiro.',
          path: ['endAt'],
        })
        return
      }
      if (!allDayRangeValid(data.startAt, data.endAt)) {
        context.addIssue({
          code: 'custom',
          message: 'A data de término deve ser igual ou posterior à de início.',
          path: ['endAt'],
        })
      }
      return
    }
    validateSchedule(data, context, true)
  })
  .transform((data) => ({
    ...data,
    startAt: new Date(data.startAt).toISOString(),
    endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
  }))

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
    status: z.enum(activityStatuses).optional(),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, true)
  })

export type ActivityCreateInput = z.input<typeof activityCreateSchema>
export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>
export type ActivityAgendaRequest = z.input<typeof activityAgendaRequestSchema>
export type ActivityAgendaRequestData = z.output<typeof activityAgendaRequestSchema>
export type ActivityRescheduleInput = z.input<typeof activityRescheduleSchema>

/**
 * E13 — one stop of a giro, as the composer submits it: which município and
 * what tags the stop generates. The title is deliberately NOT part of it: it
 * is composed on the server from the município's own name, so a client cannot
 * label a draft after a município it did not pick.
 */
const tourStopDraftSchema = activityFieldsSchema.pick({ municipality: true, tags: true })

export const tourStopDraftsSchema = z.array(tourStopDraftSchema)

export type TourStopDraft = z.infer<typeof tourStopDraftSchema>
