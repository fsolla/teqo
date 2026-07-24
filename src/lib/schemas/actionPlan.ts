import { z } from 'zod'

import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const actionPlanKinds = [
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

export const actionPlanStatuses = [
  'rascunho',
  'planejado',
  'confirmado',
  'realizado',
  'cancelado',
] as const

export const actionPlanKindLabels: Record<(typeof actionPlanKinds)[number], string> = {
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

export const actionPlanStatusLabels: Record<(typeof actionPlanStatuses)[number], string> = {
  rascunho: 'Rascunho',
  planejado: 'Planejado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const MAX_ACTION_PLAN_ORGANIZATIONS = 20

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  responsible: positiveRelationshipId.optional(),
  due: z.string().datetime().optional().nullable(),
  done: z.boolean().optional(),
})

const actionPlanFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(actionPlanKinds),
  status: z.enum(actionPlanStatuses).optional(),
  description: trimmedOptionalText(4000),
  deputyPresent: z.boolean().optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  municipality: positiveRelationshipId,
  locality: trimmedOptionalText(160),
  organizations: z.array(positiveRelationshipId).max(MAX_ACTION_PLAN_ORGANIZATIONS).optional(),
  advisors: z.array(positiveRelationshipId).optional(),
  responsible: positiveRelationshipId.optional(),
  leadership: positiveRelationshipId.optional(),
  tasks: z.array(taskSchema).optional(),
})

const validateSchedule = (
  data: {
    status?: (typeof actionPlanStatuses)[number] | null
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
      message: 'Informe a data e horário de início ao planejar ou confirmar o plano.',
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

export const actionPlanCreateSchema = actionPlanFieldsSchema
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

export const actionPlanUpdateSchema = actionPlanFieldsSchema
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
    status: z.enum(actionPlanStatuses).optional(),
  })
  .superRefine((data, context) => {
    validateSchedule(data, context, 'patch')
  })

export type ActionPlanCreateInput = z.input<typeof actionPlanCreateSchema>
export type ActionPlanUpdateInput = z.input<typeof actionPlanUpdateSchema>
