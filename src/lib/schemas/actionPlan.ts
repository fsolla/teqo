import { z } from 'zod'

import {
  isBahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import {
  dedupeTrimmedStrings,
  MAX_NUCLEUS_CITIES,
  MAX_NUCLEUS_NEIGHBORHOODS,
  MAX_NUCLEUS_REGIONS,
} from '@/lib/schemas/nucleus'
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

const regionsArraySchema = z
  .array(z.string())
  .max(MAX_NUCLEUS_REGIONS)
  .transform(dedupeTrimmedStrings)
  .superRefine((regions, context) => {
    for (const [index, region] of regions.entries()) {
      if (!isBahiaIdentityTerritory(region)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um território de identidade válido da Bahia.',
          path: [index],
        })
      }
    }
  })

const citiesArraySchema = z
  .array(z.string())
  .max(MAX_NUCLEUS_CITIES)
  .transform(dedupeTrimmedStrings)
  .superRefine((cities, context) => {
    for (const [index, city] of cities.entries()) {
      if (city.length > 120 || !isBahiaMunicipality(city)) {
        context.addIssue({
          code: 'custom',
          message: 'Selecione um município válido da Bahia.',
          path: [index],
        })
      }
    }
  })

const neighborhoodsArraySchema = z
  .array(z.string().max(160))
  .max(MAX_NUCLEUS_NEIGHBORHOODS)
  .transform(dedupeTrimmedStrings)

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
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  regions: regionsArraySchema.optional(),
  cities: citiesArraySchema.optional(),
  neighborhoods: neighborhoodsArraySchema.optional(),
  locality: trimmedOptionalText(160),
  territoryNotes: trimmedOptionalText(2000),
  coordinators: z.array(positiveRelationshipId).optional(),
  responsible: positiveRelationshipId.optional(),
  leadership: positiveRelationshipId.optional(),
  tasks: z.array(taskSchema).optional(),
})

type TerritoryValidationInput = {
  regions?: string[] | null
  cities?: string[] | null
  neighborhoods?: string[] | null
  locality?: string | null
}

const validateTerritory = (
  data: TerritoryValidationInput,
  context: z.RefinementCtx,
  mode: 'create' | 'patch',
) => {
  const regions = data.regions ?? []
  const cities = data.cities ?? []
  const neighborhoods = data.neighborhoods ?? []
  const locality = data.locality ?? undefined

  const geographyWasFullyProvided =
    data.regions !== undefined && data.cities !== undefined && data.locality !== undefined
  if (
    regions.length === 0 &&
    cities.length === 0 &&
    !locality &&
    (mode === 'create' || geographyWasFullyProvided)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Informe o território de identidade, município ou localidade do plano.',
      path: ['cities'],
    })
  }

  if (neighborhoods.length > 0 && cities.length !== 1) {
    context.addIssue({
      code: 'custom',
      message:
        cities.length === 0
          ? 'Informe o município antes do bairro.'
          : 'Bairros só podem ser informados quando há exatamente um município.',
      path: ['neighborhoods'],
    })
  }
}

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
    validateTerritory(data, context, 'create')
    validateSchedule(data, context, 'create')
  })
  .transform((data) => {
    const cities = data.cities ?? []
    const regions =
      cities.length > 0
        ? territoriesForCities(cities)
        : (data.regions ?? []).filter(isBahiaIdentityTerritory)
    const neighborhoods = cities.length === 1 ? (data.neighborhoods ?? []) : []
    return {
      ...data,
      regions,
      cities,
      neighborhoods,
      startAt: data.startAt ?? null,
      endAt: data.endAt ?? null,
      deadline: data.deadline ?? null,
    }
  })

export const actionPlanUpdateSchema = actionPlanFieldsSchema
  .partial()
  .extend({
    id: positiveRelationshipId,
    regions: regionsArraySchema.nullable().optional(),
    cities: citiesArraySchema.nullable().optional(),
    neighborhoods: neighborhoodsArraySchema.nullable().optional(),
    locality: trimmedNullableText(160),
    territoryNotes: trimmedNullableText(2000),
    description: trimmedNullableText(4000),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    responsible: positiveRelationshipId.nullable().optional(),
    leadership: positiveRelationshipId.nullable().optional(),
    status: z.enum(actionPlanStatuses).optional(),
  })
  .superRefine((data, context) => {
    validateTerritory(data, context, 'patch')
    validateSchedule(data, context, 'patch')
  })
  .transform((data) => {
    const cities = data.cities === undefined ? undefined : (data.cities ?? [])
    const neighborhoods =
      data.neighborhoods === undefined
        ? undefined
        : cities !== undefined && cities.length !== 1
          ? []
          : (data.neighborhoods ?? [])
    const regions =
      cities === undefined
        ? data.regions === undefined
          ? undefined
          : (data.regions ?? []).filter(isBahiaIdentityTerritory)
        : cities.length > 0
          ? territoriesForCities(cities)
          : data.regions === undefined
            ? []
            : (data.regions ?? []).filter(isBahiaIdentityTerritory)

    return {
      ...data,
      ...(regions !== undefined ? { regions } : {}),
      ...(cities !== undefined ? { cities } : {}),
      ...(neighborhoods !== undefined ? { neighborhoods } : {}),
    }
  })

export type ActionPlanCreateInput = z.input<typeof actionPlanCreateSchema>
export type ActionPlanUpdateInput = z.input<typeof actionPlanUpdateSchema>
