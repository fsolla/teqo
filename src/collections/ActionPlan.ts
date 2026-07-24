import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  actionPlanKindLabels,
  actionPlanKinds,
  actionPlanStatusLabels,
  actionPlanStatuses,
} from '@/lib/schemas/actionPlan'
import {
  canCreateActionPlan,
  canCreateActionPlanAdvisors,
  canDeleteActionPlan,
  canManageActionPlanAdvisors,
  canReadActionPlan,
  canSetActionPlanStatus,
  canSetActionPlanSystemField,
  canUpdateActionPlan,
  eligibleCampaignStaffWhere,
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'
import { slugify } from '@/utilities/slug'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const isActionPlanMutationShortcut = (context: Record<string, unknown> | undefined) =>
  context?.mutationKind === 'taskToggle' || context?.mutationKind === 'appendUpdate'

const ACTION_PLAN_KIND_OPTIONS = actionPlanKinds.map((value) => ({
  value,
  label: actionPlanKindLabels[value],
}))

const ACTION_PLAN_STATUS_OPTIONS = actionPlanStatuses.map((value) => ({
  value,
  label: actionPlanStatusLabels[value],
}))

const relationshipIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

const actionPlanStaffFieldSnapshot = (doc: Record<string, unknown>) => ({
  title: trimmedText(doc.title),
  slug: doc.slug ?? null,
  kind: doc.kind ?? null,
  status: doc.status ?? null,
  description: trimmedText(doc.description),
  startAt: doc.startAt ?? null,
  endAt: doc.endAt ?? null,
  deadline: doc.deadline ?? null,
  municipality: relationshipId(doc.municipality),
  locality: trimmedText(doc.locality),
  deputyPresent: Boolean(doc.deputyPresent),
  organizations: relationshipIds(doc.organizations),
  advisors: relationshipIds(doc.advisors),
  responsible: relationshipId(doc.responsible),
  leadership: relationshipId(doc.leadership),
  resultSummary: trimmedText(doc.resultSummary),
  resultMedia: relationshipIds(doc.resultMedia),
})

const setCanonicalActionPlanSlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
  context,
}) => {
  if (isActionPlanMutationShortcut(context)) return data
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
  context,
}) => {
  if (isActionPlanMutationShortcut(context)) return data
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const status = typeof nextData.status === 'string' ? nextData.status : 'rascunho'
  const startAt = nextData.startAt ?? null
  const endAt = nextData.endAt ?? null

  if (status !== 'rascunho' && !startAt) {
    throw new APIError('Informe a data e horário de início ao planejar ou confirmar o plano.', 400)
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

const validateActionPlanAdvisors: CollectionBeforeValidateHook = async ({ data, req, context }) => {
  if (isActionPlanMutationShortcut(context)) return data
  if (!data) return data
  if (data.advisors === undefined) return data

  const advisorIDs = [...new Set(relationshipIds(data.advisors))]
  if (advisorIDs.length === 0) return data

  const eligibleAdvisors = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: advisorIDs } }, eligibleCampaignStaffWhere],
    },
    select: { name: true },
    overrideAccess: true,
    req,
  })

  if (eligibleAdvisors.docs.length !== advisorIDs.length) {
    throw new APIError('Cada responsável deve ter papel de Coordenador Geral, Assessor ou Candidato.', 400)
  }

  return data
}

const deriveActionPlanFields: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.createdBy = req.user.id
    if (
      req.user.role === 'advisor' &&
      (data.advisors === undefined || (Array.isArray(data.advisors) && data.advisors.length === 0))
    ) {
      data.advisors = [req.user.id]
    }
  }

  if (Array.isArray(data.tasks)) {
    const previousTasks = Array.isArray(originalDoc?.tasks) ? originalDoc.tasks : []
    let taskDoneCount = 0
    data.tasks = data.tasks.map((task: Record<string, unknown>, index: number) => {
      const previous = previousTasks[index] as Record<string, unknown> | undefined
      const done = Boolean(task.done)
      if (done) taskDoneCount += 1
      const previousDone = Boolean(previous?.done)
      let doneAt = task.doneAt ?? previous?.doneAt ?? null
      if (done && !previousDone) {
        doneAt = new Date().toISOString()
      } else if (!done) {
        doneAt = null
      }
      return { ...task, done, doneAt }
    })
    data.taskTotal = data.tasks.length
    data.taskDoneCount = taskDoneCount
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
        author: req.user?.collection === 'campaignUser' ? req.user.id : (update.author ?? null),
        createdAt: new Date().toISOString(),
      }
    })
  }

  const resultChanged =
    (data.resultSummary !== undefined &&
      trimmedText(data.resultSummary) !== trimmedText(originalDoc?.resultSummary)) ||
    (data.resultMedia !== undefined &&
      JSON.stringify(relationshipIds(data.resultMedia)) !==
        JSON.stringify(relationshipIds(originalDoc?.resultMedia)))

  if (resultChanged) {
    data.resultRecordedAt = new Date().toISOString()
    if (req.user?.collection === 'campaignUser') data.resultRecordedBy = req.user.id
  }

  if (
    operation === 'update' &&
    req.user?.collection === 'campaignUser' &&
    req.user.role === 'leader'
  ) {
    if (!isActionPlanMutationShortcut(req.context)) {
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
          throw new APIError('Lideranças só podem marcar tarefas como concluídas.', 403)
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
    defaultColumns: ['title', 'kind', 'status', 'municipality', 'startAt', 'updatedAt'],
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
      validateActionPlanSchedule,
      validateActionPlanAdvisors,
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
      name: 'deputyPresent',
      type: 'checkbox',
      label: 'Deputado presente',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Marque quando o deputado Jorge Solla estiver presente na ação.',
      },
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
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Praça',
      required: true,
      index: true,
    },
    {
      name: 'locality',
      type: 'text',
      label: 'Local (bairro, endereço ou referência)',
      maxLength: 160,
    },
    {
      name: 'organizations',
      type: 'relationship',
      relationTo: 'organization',
      label: 'Organizações apoiadoras',
      hasMany: true,
      index: true,
    },
    {
      name: 'advisors',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Assessores responsáveis',
      hasMany: true,
      index: true,
      access: {
        create: canCreateActionPlanAdvisors,
        update: canManageActionPlanAdvisors,
      },
      filterOptions: eligibleCampaignStaffWhere,
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
      name: 'taskTotal',
      type: 'number',
      label: 'Total de tarefas',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
    },
    {
      name: 'taskDoneCount',
      type: 'number',
      label: 'Tarefas concluídas',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
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
      name: 'resultSummary',
      type: 'textarea',
      label: 'Resultado da ação',
      maxLength: 6000,
      access: {
        create: canSetActionPlanStatus,
        update: canSetActionPlanStatus,
      },
      admin: {
        description:
          'O que aconteceu, público, aprendizados. Vira base para futuras atividades na mesma Praça.',
      },
    },
    {
      name: 'resultMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Fotos e vídeos do resultado',
      hasMany: true,
      access: {
        create: canSetActionPlanStatus,
        update: canSetActionPlanStatus,
      },
    },
    {
      name: 'resultRecordedBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Resultado registrado por',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
    },
    {
      name: 'resultRecordedAt',
      type: 'date',
      label: 'Resultado registrado em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetActionPlanSystemField,
        update: canSetActionPlanSystemField,
      },
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
