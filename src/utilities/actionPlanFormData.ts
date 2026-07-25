import 'server-only'

import {
  boundedJsonFormValue,
  checkboxFormValue,
  FormDataBoundaryError,
  nullableRelationshipFormValue,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  actionPlanDemandDraftsSchema,
  actionPlanKinds,
  actionPlanOrigins,
  actionPlanStatuses,
  MAX_ACTION_PLAN_DEMAND_DRAFTS,
  type ActionPlanCreateInput,
  type ActionPlanDemandDraft,
  type ActionPlanUpdateInput,
} from '@/lib/schemas/actionPlan'
import { parseBahiaDateTimeInput } from '@/utilities/campaignTime'

type ParsedActionPlanTask = {
  title: string
  responsible?: number
  due?: string
  done?: boolean
}

const parseDateTimeFormField = (formData: FormData, field: string): string | undefined => {
  const value = optionalFormText(formData, field)
  if (!value) return undefined
  const iso = parseBahiaDateTimeInput(value)
  if (!iso) throw new FormDataBoundaryError(field, 'Data e horário inválidos.')
  return iso
}

const parseTasksFormData = (formData: FormData): ParsedActionPlanTask[] => {
  const raw = boundedJsonFormValue(formData, 'tasksJson', 20_000)
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new FormDataBoundaryError('tasksJson', 'Lista de tarefas inválida.')
  }

  return raw.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new FormDataBoundaryError('tasksJson', `Tarefa ${index + 1} inválida.`)
    }
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) {
      throw new FormDataBoundaryError('tasksJson', `Informe o título da tarefa ${index + 1}.`)
    }
    if (title.length > 200) {
      throw new FormDataBoundaryError('tasksJson', `O título da tarefa ${index + 1} é muito longo.`)
    }
    const responsible =
      typeof record.responsible === 'number' &&
      Number.isInteger(record.responsible) &&
      record.responsible > 0
        ? record.responsible
        : undefined
    const dueRaw = typeof record.due === 'string' ? record.due : undefined
    const due = dueRaw ? (parseBahiaDateTimeInput(dueRaw) ?? undefined) : undefined
    if (dueRaw && !due) {
      throw new FormDataBoundaryError('tasksJson', `Prazo inválido na tarefa ${index + 1}.`)
    }
    const done = typeof record.done === 'boolean' ? record.done : undefined

    return {
      title,
      ...(responsible ? { responsible } : {}),
      ...(due ? { due } : {}),
      ...(done !== undefined ? { done } : {}),
    }
  })
}

const parseDemandDraftsFormData = (formData: FormData): ActionPlanDemandDraft[] => {
  const raw = boundedJsonFormValue(formData, 'demandsJson', 80_000)
  if (raw === undefined) return []
  const parsed = actionPlanDemandDraftsSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const demandIndex = parsed.error.issues[0]?.path[0]
  if (typeof demandIndex === 'number') {
    throw new FormDataBoundaryError('demandsJson', `Demanda ${demandIndex + 1} inválida.`)
  }
  if (!Array.isArray(raw) || raw.length > MAX_ACTION_PLAN_DEMAND_DRAFTS) {
    throw new FormDataBoundaryError(
      'demandsJson',
      `Informe no máximo ${MAX_ACTION_PLAN_DEMAND_DRAFTS} demandas válidas.`,
    )
  }
  throw new FormDataBoundaryError('demandsJson', 'Lista de demandas inválida.')
}

const parseSharedActionPlanFormData = (formData: FormData) => {
  const responsible = nullableRelationshipFormValue(formData, 'responsible')
  const leadership = nullableRelationshipFormValue(formData, 'leadership')

  return {
    title: optionalFormText(formData, 'title') ?? '',
    kind: optionalFormText(formData, 'kind') as (typeof actionPlanKinds)[number],
    origin: optionalFormText(formData, 'origin') as (typeof actionPlanOrigins)[number] | undefined,
    status: optionalFormText(formData, 'status') as (typeof actionPlanStatuses)[number] | undefined,
    description: optionalFormText(formData, 'description'),
    deputyPresent: checkboxFormValue(formData, 'deputyPresent'),
    startAt: parseDateTimeFormField(formData, 'startAt'),
    endAt: parseDateTimeFormField(formData, 'endAt'),
    deadline: parseDateTimeFormField(formData, 'deadline'),
    municipality: requiredRelationshipFormValue(formData, 'municipality'),
    locality: optionalFormText(formData, 'locality'),
    organizations: repeatedRelationshipFormValues(formData, 'organizations'),
    responsible,
    leadership,
    tasks: parseTasksFormData(formData),
    demands: parseDemandDraftsFormData(formData),
  }
}

export type ParsedActionPlanCreateFormData = ActionPlanCreateInput & {
  demands: ActionPlanDemandDraft[]
}

export const parseActionPlanCreateFormData = (
  formData: FormData,
): ParsedActionPlanCreateFormData => {
  const shared = parseSharedActionPlanFormData(formData)
  const advisorIds = repeatedRelationshipFormValues(formData, 'advisors')

  return {
    ...shared,
    status: (shared.status ?? 'rascunho') as ActionPlanCreateInput['status'],
    responsible: shared.responsible ?? undefined,
    leadership: shared.leadership ?? undefined,
    organizations: shared.organizations.length ? shared.organizations : undefined,
    advisors: advisorIds.length ? advisorIds : undefined,
  }
}

export type ParsedActionPlanUpdateFormData = ActionPlanUpdateInput & {
  demands: ActionPlanDemandDraft[]
}

export const parseActionPlanUpdateFormData = (
  formData: FormData,
): ParsedActionPlanUpdateFormData => {
  const shared = parseSharedActionPlanFormData(formData)
  const advisorIds = repeatedRelationshipFormValues(formData, 'advisors')
  // Checkboxes only submit when checked, so a hidden marker distinguishes
  // "advisors section rendered but all unchecked" from "not editable" (advisor view).
  const hasAdvisors = formData.has('advisorsSubmitted')

  return {
    ...shared,
    id: requiredRelationshipFormValue(formData, 'id'),
    status: shared.status as ActionPlanUpdateInput['status'],
    locality: shared.locality ?? null,
    description: shared.description ?? null,
    startAt: shared.startAt ?? null,
    endAt: shared.endAt ?? null,
    deadline: shared.deadline ?? null,
    responsible: shared.responsible,
    leadership: shared.leadership,
    organizations: shared.organizations,
    advisors: hasAdvisors ? advisorIds : undefined,
  }
}
