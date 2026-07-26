import { z } from 'zod'

import { campaignDemandCreateSchema } from '@/lib/schemas/campaignDemandInput'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const activityKinds = [
  'caminhada',
  'comicio',
  'carreata',
  'panfletagem',
  'porta_a_porta',
  'reuniao_apoio',
  'lancamento',
  'convencao',
  'ato',
  'entrevista',
  'producao_conteudo',
  'digital',
  'outro',
] as const

export const activityStatuses = [
  'rascunho',
  'planejado',
  'confirmado',
  'realizado',
  'cancelado',
] as const

export const activityOrigins = ['dado', 'pedido_broker', 'obrigacao_politica'] as const
export type ActivityOrigin = (typeof activityOrigins)[number]

export const activityOriginLabels: Record<ActivityOrigin, string> = {
  dado: 'Baseado em dado',
  pedido_broker: 'Pedido de broker',
  obrigacao_politica: 'Obrigação política',
}

export const activityKindLabels: Record<(typeof activityKinds)[number], string> = {
  caminhada: 'Caminhada',
  comicio: 'Comício',
  carreata: 'Carreata',
  panfletagem: 'Panfletagem',
  porta_a_porta: 'Porta a porta',
  reuniao_apoio: 'Reunião de apoio',
  lancamento: 'Lançamento',
  convencao: 'Convenção',
  ato: 'Ato',
  entrevista: 'Entrevista',
  producao_conteudo: 'Produção de conteúdo',
  digital: 'Digital',
  outro: 'Outro',
}

export const activityStatusLabels: Record<(typeof activityStatuses)[number], string> = {
  rascunho: 'Rascunho',
  planejado: 'Planejado',
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

const activityFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(activityKinds),
  status: z.enum(activityStatuses).optional(),
  description: trimmedOptionalText(4000),
  deputyPresent: z.boolean().optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  municipality: positiveRelationshipId,
  locality: trimmedOptionalText(160),
  organizations: z.array(positiveRelationshipId).max(MAX_ACTIVITY_ORGANIZATIONS).optional(),
  advisors: z.array(positiveRelationshipId).optional(),
  responsible: positiveRelationshipId.optional(),
  leadership: positiveRelationshipId.optional(),
  tasks: z.array(taskSchema).optional(),
  origin: z.enum(activityOrigins).optional(),
})

const validateSchedule = (
  data: {
    status?: (typeof activityStatuses)[number] | null
    startAt?: string | null
    endAt?: string | null
  },
  context: z.RefinementCtx,
  mode: 'create' | 'patch',
) => {
  const status = data.status ?? (mode === 'create' ? 'rascunho' : undefined)
  if (status && status !== 'rascunho' && !data.startAt) {
    context.addIssue({
      code: 'custom',
      message: 'Informe a data e horário de início ao planejar ou confirmar a atividade.',
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
    status: z.enum(['rascunho', 'planejado']).default('rascunho'),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, 'create')
  })
  .transform((data) => ({
    ...data,
    startAt: data.startAt ?? null,
    endAt: data.endAt ?? null,
    deadline: data.deadline ?? null,
  }))

export const activityUpdateSchema = activityFieldsSchema
  .partial()
  .extend({
    id: positiveRelationshipId,
    locality: trimmedNullableText(160),
    description: trimmedNullableText(4000),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    responsible: positiveRelationshipId.nullable().optional(),
    leadership: positiveRelationshipId.nullable().optional(),
    status: z.enum(activityStatuses).optional(),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, 'patch')
  })

export type ActivityCreateInput = z.input<typeof activityCreateSchema>
export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>
