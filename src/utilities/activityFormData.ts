import 'server-only'

import { parseBahiaDateTimeInput } from '@/lib/campaignTime'
import {
  boundedJsonFormValue,
  checkboxFormValue,
  FormDataBoundaryError,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  activityDemandDraftsSchema,
  activityResponsibleSchema,
  activityStatuses,
  MAX_ACTIVITY_DEMAND_DRAFTS,
  MAX_ACTIVITY_RESPONSIBLES,
  MAX_ACTIVITY_TAG_LENGTH,
  MAX_ACTIVITY_TAGS,
  tourStopDraftsSchema,
  type ActivityCreateInput,
  type ActivityDemandDraft,
  type ActivityResponsibleCollection,
  type ActivityUpdateInput,
  type TourStopDraft,
} from '@/lib/schemas/activity'
import { MAX_TOUR_NAME_LENGTH, TOUR_EMPTY_MESSAGE } from '@/utilities/visit/visitPlannerViews'

type ParsedActivityTask = {
  title: string
  responsible?: number
  due?: string
  done?: boolean
}

const parseDateTimeFormField = (formData: FormData, field: string): string | undefined => {
  const value = optionalFormText(formData, field)
  if (!value) return undefined
  const iso = parseBahiaDateTimeInput(value)
  if (!iso) throw new FormDataBoundaryError(field, 'Data e horários inválidos.')
  return iso
}

const parseTasksFormData = (formData: FormData): ParsedActivityTask[] => {
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

const parseDemandDraftsFormData = (formData: FormData): ActivityDemandDraft[] => {
  const raw = boundedJsonFormValue(formData, 'demandsJson', 80_000)
  if (raw === undefined) return []
  const parsed = activityDemandDraftsSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const demandIndex = parsed.error.issues[0]?.path[0]
  if (typeof demandIndex === 'number') {
    throw new FormDataBoundaryError('demandsJson', `Demanda ${demandIndex + 1} inválida.`)
  }
  if (!Array.isArray(raw) || raw.length > MAX_ACTIVITY_DEMAND_DRAFTS) {
    throw new FormDataBoundaryError(
      'demandsJson',
      `Informe no máximo ${MAX_ACTIVITY_DEMAND_DRAFTS} demandas válidas.`,
    )
  }
  throw new FormDataBoundaryError('demandsJson', 'Lista de demandas inválida.')
}

const parseTagsFormData = (formData: FormData): string[] => {
  const raw = boundedJsonFormValue(formData, 'tagsJson', 4_000)
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new FormDataBoundaryError('tagsJson', 'Lista de tags inválida.')
  }
  const tags = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.slice(0, MAX_ACTIVITY_TAG_LENGTH))
    .slice(0, MAX_ACTIVITY_TAGS)
  return tags
}

type ParsedResponsible = {
  relationTo: ActivityResponsibleCollection
  value: number
}

/**
 * C90 — the polymorphic multi-value `responsible` submits as a bounded JSON
 * field (same precedent as `tasksJson`/`tagsJson`): repeated hidden inputs
 * would lose the `relationTo` correlation.
 */
const parseResponsiblesFormData = (formData: FormData): ParsedResponsible[] => {
  const raw = boundedJsonFormValue(formData, 'responsiblesJson', 8_000)
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new FormDataBoundaryError('responsiblesJson', 'Lista de responsáveis inválida.')
  }
  if (raw.length > MAX_ACTIVITY_RESPONSIBLES) {
    throw new FormDataBoundaryError(
      'responsiblesJson',
      `Informe no máximo ${MAX_ACTIVITY_RESPONSIBLES} responsáveis.`,
    )
  }
  return raw.map((item, index) => {
    const parsed = activityResponsibleSchema.safeParse(item)
    if (!parsed.success) {
      throw new FormDataBoundaryError(
        'responsiblesJson',
        `Responsável ${index + 1} inválido. Atualize a página e refaça a escolha.`,
      )
    }
    return parsed.data
  })
}

const parseSharedActivityFormData = (formData: FormData) => {
  return {
    title: optionalFormText(formData, 'title') ?? '',
    tags: parseTagsFormData(formData),
    status: optionalFormText(formData, 'status') as (typeof activityStatuses)[number] | undefined,
    description: optionalFormText(formData, 'description'),
    deputyPresent: checkboxFormValue(formData, 'deputyPresent'),
    startAt: parseDateTimeFormField(formData, 'startAt'),
    endAt: parseDateTimeFormField(formData, 'endAt'),
    municipality: requiredRelationshipFormValue(formData, 'municipality'),
    locality: optionalFormText(formData, 'locality'),
    organizations: repeatedRelationshipFormValues(formData, 'organizations'),
    responsible: parseResponsiblesFormData(formData),
    tasks: parseTasksFormData(formData),
    demands: parseDemandDraftsFormData(formData),
  }
}

export type ParsedActivityCreateFormData = ActivityCreateInput & {
  demands: ActivityDemandDraft[]
}

export const parseActivityCreateFormData = (formData: FormData): ParsedActivityCreateFormData => {
  const shared = parseSharedActivityFormData(formData)

  return {
    ...shared,
    status: (shared.status ?? 'confirmado') as ActivityCreateInput['status'],
    responsible: shared.responsible.length ? shared.responsible : undefined,
    organizations: shared.organizations.length ? shared.organizations : undefined,
  }
}

/**
 * E13 — the composer submits its stops as one bounded JSON field, the precedent
 * `tasksJson`/`demandsJson` already set: the alternative is per-stop field names
 * whose correlation has to be reconstructed from `FormData` ordering.
 *
 * The stop shape itself is a zod schema picked from the activity fields, so this
 * boundary only has to decide the ONE thing zod cannot: which message the mesa
 * sees. Titles are not parsed here — the action composes them from the município
 * names it reads for the scope check.
 */
export type ParsedTourDraftFormData = {
  tourName: string
  note: string | undefined
  stops: TourStopDraft[]
}

export const parseTourDraftFormData = (formData: FormData): ParsedTourDraftFormData => {
  const tourName = requiredFormText(formData, 'tourName')
  if (tourName.length > MAX_TOUR_NAME_LENGTH) {
    throw new FormDataBoundaryError('tourName', 'Nome do giro muito longo.')
  }

  const parsed = tourStopDraftsSchema.safeParse(boundedJsonFormValue(formData, 'stopsJson', 20_000))
  if (!parsed.success) {
    throw new FormDataBoundaryError(
      'stopsJson',
      'Paradas do giro inválidas. Atualize a página e monte o giro novamente.',
    )
  }
  if (parsed.data.length === 0) throw new FormDataBoundaryError('stopsJson', TOUR_EMPTY_MESSAGE)

  return { tourName, note: optionalFormText(formData, 'note'), stops: parsed.data }
}

export type ParsedActivityUpdateFormData = ActivityUpdateInput & {
  demands: ActivityDemandDraft[]
}

export const parseActivityUpdateFormData = (formData: FormData): ParsedActivityUpdateFormData => {
  const shared = parseSharedActivityFormData(formData)

  return {
    ...shared,
    id: requiredRelationshipFormValue(formData, 'id'),
    status: shared.status as ActivityUpdateInput['status'],
    locality: shared.locality ?? null,
    description: shared.description ?? null,
    startAt: shared.startAt ?? null,
    endAt: shared.endAt ?? null,
    organizations: shared.organizations,
    // Update always submits the full list (possibly empty) so clearing works.
    // Invariant: the form always renders `responsiblesJson` (even empty) — a
    // partial form that omits it would silently clear `responsible`.
    responsible: shared.responsible,
  }
}
