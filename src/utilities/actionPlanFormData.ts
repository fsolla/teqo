import 'server-only'

import {
  bahiaIdentityTerritories,
  type BahiaIdentityTerritory,
  isBahiaMunicipality,
  territoriesForCities,
} from '@/lib/bahiaTerritories'
import {
  actionPlanKinds,
  actionPlanStatuses,
  type ActionPlanCreateInput,
  type ActionPlanUpdateInput,
} from '@/lib/schemas/actionPlan'
import {
  boundedJsonFormValue,
  FormDataBoundaryError,
  nullableRelationshipFormValue,
  optionalFormText,
  repeatedFormTexts,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
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
      throw new FormDataBoundaryError(
        'tasksJson',
        `O título da tarefa ${index + 1} é muito longo.`,
      )
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

const parseSharedActionPlanFormData = (formData: FormData) => {
  const cities = repeatedFormTexts(formData, 'cities')
  const regions =
    cities.length > 0
      ? territoriesForCities(cities)
      : (repeatedFormTexts(formData, 'regions') as BahiaIdentityTerritory[])
  const neighborhoods = cities.length === 1 ? repeatedFormTexts(formData, 'neighborhoods') : []
  const responsible = nullableRelationshipFormValue(formData, 'responsible')
  const leadership = nullableRelationshipFormValue(formData, 'leadership')

  return {
    title: optionalFormText(formData, 'title') ?? '',
    kind: optionalFormText(formData, 'kind') as (typeof actionPlanKinds)[number],
    status: optionalFormText(formData, 'status') as (typeof actionPlanStatuses)[number] | undefined,
    description: optionalFormText(formData, 'description'),
    startAt: parseDateTimeFormField(formData, 'startAt'),
    endAt: parseDateTimeFormField(formData, 'endAt'),
    deadline: parseDateTimeFormField(formData, 'deadline'),
    regions,
    cities,
    neighborhoods,
    locality: optionalFormText(formData, 'locality'),
    territoryNotes: optionalFormText(formData, 'territoryNotes'),
    responsible,
    leadership,
    tasks: parseTasksFormData(formData),
  }
}

const validateTerritoryFormData = (
  territory: {
    regions: string[]
    cities: string[]
    neighborhoods: string[]
    locality?: string
  },
  { requireGeography }: { requireGeography: boolean },
) => {
  for (const region of territory.regions) {
    if (!bahiaIdentityTerritories.includes(region as never)) {
      throw new FormDataBoundaryError('regions', 'Território de identidade inválido.')
    }
  }
  for (const city of territory.cities) {
    if (!isBahiaMunicipality(city)) {
      throw new FormDataBoundaryError('cities', 'Município inválido.')
    }
  }
  if (territory.neighborhoods.length > 0 && territory.cities.length !== 1) {
    throw new FormDataBoundaryError(
      'neighborhoods',
      territory.cities.length === 0
        ? 'Informe o município antes do bairro.'
        : 'Bairros só podem ser informados quando há exatamente um município.',
    )
  }
  if (
    requireGeography &&
    territory.regions.length === 0 &&
    territory.cities.length === 0 &&
    !territory.locality
  ) {
    throw new FormDataBoundaryError(
      'cities',
      'Informe o território de identidade, município ou localidade do plano.',
    )
  }
}

export const parseActionPlanCreateFormData = (formData: FormData): ActionPlanCreateInput => {
  const shared = parseSharedActionPlanFormData(formData)
  validateTerritoryFormData(shared, { requireGeography: false })
  const coordinatorIds = repeatedRelationshipFormValues(formData, 'coordinators')

  return {
    ...shared,
    status: (shared.status ?? 'rascunho') as ActionPlanCreateInput['status'],
    responsible: shared.responsible ?? undefined,
    leadership: shared.leadership ?? undefined,
    coordinators: coordinatorIds.length ? coordinatorIds : undefined,
  }
}

export const parseActionPlanUpdateFormData = (formData: FormData): ActionPlanUpdateInput => {
  const shared = parseSharedActionPlanFormData(formData)
  validateTerritoryFormData(shared, { requireGeography: true })
  const coordinatorIds = repeatedRelationshipFormValues(formData, 'coordinators')
  // Checkboxes only submit when checked, so a hidden marker distinguishes
  // "coordinators section rendered but all unchecked" from "not editable" (coordenador view).
  const hasCoordinators = formData.has('coordinatorsSubmitted')

  return {
    ...shared,
    id: requiredRelationshipFormValue(formData, 'id'),
    status: shared.status as ActionPlanUpdateInput['status'],
    regions: shared.regions,
    cities: shared.cities,
    neighborhoods: shared.neighborhoods,
    locality: shared.locality ?? null,
    territoryNotes: shared.territoryNotes ?? null,
    description: shared.description ?? null,
    startAt: shared.startAt ?? null,
    endAt: shared.endAt ?? null,
    deadline: shared.deadline ?? null,
    responsible: shared.responsible,
    leadership: shared.leadership,
    coordinators: hasCoordinators ? coordinatorIds : undefined,
  }
}
