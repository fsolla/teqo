import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import { isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import {
  actionPlanKindLabels,
  actionPlanKinds,
  actionPlanStatusLabels,
  actionPlanStatuses,
} from '@/lib/schemas/actionPlan'
import {
  MAX_NUCLEUS_CITIES,
  MAX_NUCLEUS_NEIGHBORHOODS,
  MAX_NUCLEUS_REGIONS,
} from '@/lib/schemas/nucleus'
import {
  canCreateActionPlan,
  canCreateActionPlanCoordinators,
  canDeleteActionPlan,
  canManageActionPlanCoordinators,
  canReadActionPlan,
  canSetActionPlanStatus,
  canSetActionPlanSystemField,
  canUpdateActionPlan,
} from '@/utilities/campaignAccess'
import { createCampaignTerritoryValidationHook } from '@/utilities/campaignTerritoryValidation'
import { eligibleNucleusCoordinatorWhere } from '@/utilities/nucleusCoordinatorOptions'
import { relationshipId } from '@/utilities/relationship'
import { slugify } from '@/utilities/slug'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const ACTION_PLAN_KIND_OPTIONS = actionPlanKinds.map((value) => ({
  value,
  label: actionPlanKindLabels[value],
}))

const ACTION_PLAN_STATUS_OPTIONS = actionPlanStatuses.map((value) => ({
  value,
  label: actionPlanStatusLabels[value],
}))

const actionPlanStaffFieldSnapshot = (doc: Record<string, unknown>) => ({
  title: trimmedText(doc.title),
  slug: doc.slug ?? null,
  kind: doc.kind ?? null,
  status: doc.status ?? null,
  description: trimmedText(doc.description),
  startAt: doc.startAt ?? null,
  endAt: doc.endAt ?? null,
  deadline: doc.deadline ?? null,
  regions: Array.isArray(doc.regions) ? doc.regions.map(String) : [],
  cities: Array.isArray(doc.cities) ? doc.cities.map(String) : [],
  neighborhoods: Array.isArray(doc.neighborhoods) ? doc.neighborhoods.map(String) : [],
  locality: trimmedText(doc.locality),
  territoryNotes: trimmedText(doc.territoryNotes),
  coordinators: (Array.isArray(doc.coordinators) ? doc.coordinators : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null),
  responsible: relationshipId(doc.responsible),
  leadership: relationshipId(doc.leadership),
})

const validateActionPlanTerritory = createCampaignTerritoryValidationHook({
  entityLabel: 'plano',
})

const setCanonicalActionPlanSlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const title = trimmedText(data.title ?? originalDoc?.title)
  const slug = slugify(title)
  if (!slug) {
    throw new APIError('Informe um título com letras ou números.', 400)
  }
  if (operation === 'update' && data.title !== undefined && title !== originalDoc?.title) {
    throw new APIError('O título do plano não pode ser alterado após a criação.', 409)
  }
  data.title = title
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

const validateActionPlanSchedule: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const status = typeof nextData.status === 'string' ? nextData.status : 'rascunho'
  const startAt = nextData.startAt ?? null
  const endAt = nextData.endAt ?? null

  if (status !== 'rascunho' && !startAt) {
    throw new APIError(
      'Informe a data e horário de início ao planejar ou confirmar o plano.',
      400,
    )
  }

  if (startAt && endAt) {
    const start = new Date(startAt as string)
    const end = new Date(endAt as string)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(start < end)) {
      throw new APIError('O horário de término deve ser posterior ao de início.', 400)
    }
  }

  return data
}

const validateActionPlanCoordinators: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data) return data
  if (data.coordinators === undefined) return data

  const coordinatorValues = data.coordinators
  const coordinatorIDs = Array.isArray(coordinatorValues)
    ? [...new Set(coordinatorValues.map(relationshipId).filter((id): id is number => id !== null))]
    : []

  if (coordinatorIDs.length === 0) return data

  const eligibleCoordinators = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: coordinatorIDs } }, eligibleNucleusCoordinatorWhere],
    },
    select: { name: true },
    overrideAccess: true,
    req,
  })

  if (eligibleCoordinators.docs.length !== coordinatorIDs.length) {
    throw new APIError('Cada responsável deve ter papel de coordenação geral ou coordenador.', 400)
  }

  return data
}

const deriveActionPlanFields: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (!data) return data

  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.createdBy = req.user.id
    if (
      req.user.role === 'coordenador' &&
      (data.coordinators === undefined ||
        (Array.isArray(data.coordinators) && data.coordinators.length === 0))
    ) {
      data.coordinators = [req.user.id]
    }
  }

  if (Array.isArray(data.tasks)) {
    const previousTasks = Array.isArray(originalDoc?.tasks) ? originalDoc.tasks : []
    data.tasks = data.tasks.map((task: Record<string, unknown>, index: number) => {
      const previous = previousTasks[index] as Record<string, unknown> | undefined
      const done = Boolean(task.done)
      const previousDone = Boolean(previous?.done)
      let doneAt = task.doneAt ?? previous?.doneAt ?? null
      if (done && !previousDone) {
        doneAt = new Date().toISOString()
      } else if (!done) {
        doneAt = null
      }
      return { ...task, done, doneAt }
    })
  }

  if (Array.isArray(data.updates)) {
    const previousCount = Array.isArray(originalDoc?.updates) ? originalDoc.updates.length : 0
    data.updates = data.updates.map((update: Record<string, unknown>, index: number) => {
      if (index < previousCount) {
        const previous = (originalDoc?.updates as Record<string, unknown>[])[index]
        return previous
      }
      return {
        body: trimmedText(update.body),
        author:
          req.user?.collection === 'campaignUser'
            ? req.user.id
            : (update.author ?? null),
        createdAt: new Date().toISOString(),
      }
    })
  }

  if (operation === 'update' && req.user?.collection === 'campaignUser' && req.user.role === 'lideranca') {
    const previous = (originalDoc ?? {}) as Record<string, unknown>
    const merged = { ...previous, ...(data as Record<string, unknown>) }
    if (
      JSON.stringify(actionPlanStaffFieldSnapshot(previous)) !==
      JSON.stringify(actionPlanStaffFieldSnapshot(merged))
    ) {
      throw new APIError(
        'Lideranças só podem marcar tarefas e registrar atualizações no plano.',
        403,
      )
    }

    if (Array.isArray(data.tasks) && Array.isArray(originalDoc?.tasks)) {
      const previousTasks = originalDoc.tasks as Record<string, unknown>[]
      if (data.tasks.length !== previousTasks.length) {
        throw new APIError('Lideranças não podem adicionar ou remover tarefas.', 403)
      }
      for (const [index, task] of data.tasks.entries()) {
        const previousTask = previousTasks[index]
        const taskRecord = task as Record<string, unknown>
        if (
          trimmedText(taskRecord.title) !== trimmedText(previousTask.title) ||
          relationshipId(taskRecord.responsible) !== relationshipId(previousTask.responsible) ||
          (taskRecord.due ?? null) !== (previousTask.due ?? null)
        ) {
          throw new APIError(
            'Lideranças só podem marcar tarefas como concluídas.',
            403,
          )
        }
      }
    } else if (Array.isArray(data.tasks) && !Array.isArray(originalDoc?.tasks)) {
      throw new APIError('Lideranças não podem adicionar ou remover tarefas.', 403)
    }
  }

  return data
}

export const ActionPlan: CollectionConfig = {
  slug: 'actionPlan',
  labels: {
    singular: 'Plano de ação',
    plural: 'Planos de ação',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'status', 'startAt', 'updatedAt'],
  },
  access: {
    create: canCreateActionPlan,
    read: canReadActionPlan,
    update: canUpdateActionPlan,
    delete: canDeleteActionPlan,
  },
  hooks: {
    beforeValidate: [
      setCanonicalActionPlanSlug,
      validateActionPlanTerritory,
      validateActionPlanSchedule,
      validateActionPlanCoordinators,
    ],
    beforeChange: [deriveActionPlanFields],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      minLength: 2,
      maxLength: 160,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Tipo de ação',
      required: true,
      index: true,
      options: [...ACTION_PLAN_KIND_OPTIONS],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'rascunho',
      index: true,
      access: {
        create: canSetActionPlanStatus,
        update: canSetActionPlanStatus,
      },
      options: [...ACTION_PLAN_STATUS_OPTIONS],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      maxLength: 4000,
    },
    {
      name: 'startAt',
      type: 'date',
      label: 'Início',
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endAt',
      type: 'date',
      label: 'Término',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'deadline',
      type: 'date',
      label: 'Prazo de conclusão',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'regions',
      type: 'text',
      label: 'Territórios de identidade',
      hasMany: true,
      index: true,
      maxRows: MAX_NUCLEUS_REGIONS,
      validate: (value: unknown) => {
        if (value === null || value === undefined) return true
        if (!Array.isArray(value)) {
          return 'Selecione um território de identidade válido da Bahia.'
        }
        return value.every(
          (item) => typeof item === 'string' && isBahiaIdentityTerritory(item.trim()),
        )
          ? true
          : 'Selecione um território de identidade válido da Bahia.'
      },
    },
    {
      name: 'cities',
      type: 'text',
      label: 'Municípios',
      hasMany: true,
      maxLength: 120,
      index: true,
      maxRows: MAX_NUCLEUS_CITIES,
    },
    {
      name: 'neighborhoods',
      type: 'text',
      label: 'Bairros',
      hasMany: true,
      maxLength: 160,
      maxRows: MAX_NUCLEUS_NEIGHBORHOODS,
    },
    {
      name: 'locality',
      type: 'text',
      label: 'Localidade',
      maxLength: 160,
    },
    {
      name: 'territoryNotes',
      type: 'textarea',
      label: 'Observações do território',
      maxLength: 2000,
    },
    {
      name: 'coordinators',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Coordenadores',
      hasMany: true,
      index: true,
      access: {
        create: canCreateActionPlanCoordinators,
        update: canManageActionPlanCoordinators,
      },
      filterOptions: eligibleNucleusCoordinatorWhere,
    },
    {
      name: 'responsible',
      type: 'relationship',
      relationTo: 'contact',
      label: 'Responsável',
      index: true,
    },
    {
      name: 'leadership',
      type: 'relationship',
      relationTo: 'leadership',
      label: 'Liderança',
      index: true,
    },
    {
      name: 'tasks',
      type: 'array',
      label: 'Tarefas',
      labels: {
        singular: 'Tarefa',
        plural: 'Tarefas',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Título',
          required: true,
          maxLength: 200,
        },
        {
          name: 'responsible',
          type: 'relationship',
          relationTo: 'contact',
          label: 'Responsável',
        },
        {
          name: 'due',
          type: 'date',
          label: 'Prazo',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'done',
          type: 'checkbox',
          label: 'Concluída',
          defaultValue: false,
        },
        {
          name: 'doneAt',
          type: 'date',
          label: 'Concluída em',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetActionPlanSystemField,
            update: canSetActionPlanSystemField,
          },
        },
      ],
    },
    {
      name: 'updates',
      type: 'array',
      label: 'Atualizações',
      labels: {
        singular: 'Atualização',
        plural: 'Atualizações',
      },
      fields: [
        {
          name: 'body',
          type: 'textarea',
          label: 'Texto',
          required: true,
          maxLength: 4000,
        },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'campaignUser',
          label: 'Autor',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetActionPlanSystemField,
            update: canSetActionPlanSystemField,
          },
        },
        {
          name: 'createdAt',
          type: 'date',
          label: 'Criada em',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetActionPlanSystemField,
            update: canSetActionPlanSystemField,
          },
        },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Criado por',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
    },
  ],
}
