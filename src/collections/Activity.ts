import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import { allDayRangeValid } from '@/lib/activityAllDay'
import { relationshipId } from '@/lib/relationship'
import {
  ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE,
  activityStatuses,
  activityStatusLabels,
  MAX_ACTIVITY_RESPONSIBLES,
  parseActivityResponsibleEntries,
} from '@/lib/schemas/activity'
import { slugify } from '@/lib/slug'
import { trimmedText } from '@/lib/text'
import { getFreshCampaignUser } from '@/utilities/access/shared'
import {
  canCampaignUserRescheduleActivity,
  canCreateActivity,
  canDeleteActivity,
  canReadActivity,
  canSetActivityResponsible,
  canSetActivityStatus,
  canSetActivitySystemField,
  canUpdateActivity,
  eligibleCampaignStaffWhere,
} from '@/utilities/campaignAccess'
import { systemStampedActorField } from '@/utilities/campaignAuditFields'
import { activityGoogleCalendarSyncHook } from '@/utilities/googleCalendarSyncHooks'

const isActivityMutationShortcut = (context: Record<string, unknown> | undefined) =>
  context?.mutationKind === 'taskToggle' || context?.mutationKind === 'appendUpdate'

const ACTIVITY_STATUS_OPTIONS = activityStatuses.map((value) => ({
  value,
  label: activityStatusLabels[value],
}))

const relationshipIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

const activityStaffFieldSnapshot = (doc: Record<string, unknown>) => ({
  title: trimmedText(doc.title),
  slug: doc.slug ?? null,
  tags: Array.isArray(doc.tags) ? [...doc.tags].sort() : [],
  status: doc.status ?? null,
  description: trimmedText(doc.description),
  allDay: Boolean(doc.allDay),
  startAt: doc.startAt ?? null,
  endAt: doc.endAt ?? null,
  municipality: relationshipId(doc.municipality),
  locality: trimmedText(doc.locality),
  deputyPresent: Boolean(doc.deputyPresent),
  organizations: relationshipIds(doc.organizations),
  responsible: JSON.stringify(
    parseActivityResponsibleEntries(doc.responsible)
      .map(({ relationTo, value }) => `${relationTo}:${value}`)
      .sort(),
  ),
  resultSummary: trimmedText(doc.resultSummary),
  resultMedia: relationshipIds(doc.resultMedia),
})

const setCanonicalActivitySlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
  context,
}) => {
  if (isActivityMutationShortcut(context)) return data
  if (!data) return data
  const isGoogleCalendarWrite = context?.mutationKind === 'googleCalendarSync'
  const title = trimmedText(data.title ?? originalDoc?.title)
  const slug = slugify(title)
  if (!slug) {
    throw new APIError('Informe um título com letras ou números.', 400)
  }
  // C115 — the Google direction edits titles by product decision (D9); the
  // canonical slug stays frozen so public URLs never break.
  if (
    operation === 'update' &&
    !isGoogleCalendarWrite &&
    data.title !== undefined &&
    title !== originalDoc?.title
  ) {
    throw new APIError('O título da atividade não pode ser alterado após a criação.', 409)
  }
  data.title = title
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

const validateActivitySchedule: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
  context,
}) => {
  if (isActivityMutationShortcut(context)) return data
  if (!data) return data
  // Tour drafts are created without startAt; the coordination sets it later.
  if (context?.isTourDraft) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const startAt = nextData.startAt ?? null
  const endAt = nextData.endAt ?? null
  const allDay = Boolean(nextData.allDay)

  // C14: startAt is always required (no more rascunho without date).
  if (!startAt) {
    throw new APIError(
      allDay
        ? 'Informe a data de início do compromisso.'
        : 'Informe a data e horário de início do compromisso.',
      400,
    )
  }

  if (startAt && endAt) {
    const start = new Date(startAt as string)
    const end = new Date(endAt as string)
    const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
    if (allDay) {
      // C104 — all-day is day granularity: end date may equal the start date
      // (single day), never precede it.
      if (valid && !allDayRangeValid(startAt as string, endAt as string)) {
        throw new APIError('A data de término deve ser igual ou posterior à de início.', 400)
      }
    } else if (!valid || !(start < end)) {
      throw new APIError('O horário de término deve ser posterior ao de início.', 400)
    }
  }

  return data
}

/**
 * C90 — every `responsible` entry must point at a real, allowed entity:
 * staff `campaignUser` (assessor/candidato/coordenador) must stay eligible,
 * and `leadership`/`stateDeputy` ids must exist. Existence is verified as
 * admin truth so a staff member responsible for a commitment can always
 * re-save it as-is — the form's selector scopes the choice to the actor's
 * portfolio, not the save validation.
 */
const validateActivityResponsibles: CollectionBeforeValidateHook = async ({
  data,
  req,
  context,
}) => {
  if (isActivityMutationShortcut(context)) return data
  if (!data) return data
  if (data.responsible === undefined) return data

  const entries = parseActivityResponsibleEntries(data.responsible)
  if (entries.length === 0) return data
  if (entries.length > MAX_ACTIVITY_RESPONSIBLES) {
    throw new APIError(
      `Informe no máximo ${MAX_ACTIVITY_RESPONSIBLES} responsáveis pelo compromisso.`,
      400,
    )
  }

  const staffIDs = [
    ...new Set(
      entries.filter((entry) => entry.relationTo === 'campaignUser').map((entry) => entry.value),
    ),
  ]
  const leadershipIDs = [
    ...new Set(
      entries.filter((entry) => entry.relationTo === 'leadership').map((entry) => entry.value),
    ),
  ]
  const deputyIDs = [
    ...new Set(
      entries.filter((entry) => entry.relationTo === 'stateDeputy').map((entry) => entry.value),
    ),
  ]

  if (staffIDs.length > 0) {
    // bypass: eligibility is an admin truth — row access would reject
    // no-user/admin creates and empty requests; the where filter is the gate.
    const eligibleStaff = await req.payload.find({
      collection: 'campaignUser',
      depth: 0,
      pagination: false,
      where: {
        and: [{ id: { in: staffIDs } }, eligibleCampaignStaffWhere],
      },
      select: { name: true },
      overrideAccess: true,
      req,
    })
    if (eligibleStaff.docs.length !== staffIDs.length) {
      throw new APIError(
        'Cada responsável deve ter papel de Coordenador Geral, Assessor ou Candidato.',
        400,
      )
    }
  }

  if (leadershipIDs.length > 0) {
    // bypass: existence check only — the actor must be able to save an intact
    // responsible list even for leaderships outside their read scope.
    const leaderships = await req.payload.find({
      collection: 'leadership',
      depth: 0,
      pagination: false,
      where: { id: { in: leadershipIDs } },
      overrideAccess: true,
      req,
    })
    if (leaderships.docs.length !== leadershipIDs.length) {
      throw new APIError('Responsável de liderança inválido.', 400)
    }
  }

  if (deputyIDs.length > 0) {
    // bypass: existence check only — see the leadership leg above.
    const deputies = await req.payload.find({
      collection: 'stateDeputy',
      depth: 0,
      pagination: false,
      where: { id: { in: deputyIDs } },
      overrideAccess: true,
      req,
    })
    if (deputies.docs.length !== deputyIDs.length) {
      throw new APIError('Responsável de dobradinha inválido.', 400)
    }
  }

  return data
}

/**
 * C14 — deputyPresent time gate: only coordinator and candidate can reschedule
 * (change startAt/endAt) an activity where the deputy is present. Advisors can
 * create/edit the rest of the activity but cannot move the time of a
 * deputy-present commitment.
 */
const validateDeputyPresentTimeGate: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
  context,
}) => {
  if (isActivityMutationShortcut(context)) return data
  if (!data) return data
  if (operation === 'create') return data

  const timeChanged =
    (data.startAt !== undefined && data.startAt !== (originalDoc.startAt ?? null)) ||
    (data.endAt !== undefined && data.endAt !== (originalDoc.endAt ?? null))

  if (!timeChanged) return data

  const deputyPresent = Boolean(originalDoc?.deputyPresent || data.deputyPresent)
  if (!deputyPresent) return data

  if (!req.user || req.user.collection !== 'campaignUser') return data
  const user = await getFreshCampaignUser(req)

  if (!user || !canCampaignUserRescheduleActivity(user, deputyPresent)) {
    throw new APIError(ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE, 403)
  }

  return data
}

const deriveActivityFields: CollectionBeforeChangeHook = ({
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
      (data.responsible === undefined ||
        (Array.isArray(data.responsible) && data.responsible.length === 0))
    ) {
      data.responsible = [{ relationTo: 'campaignUser', value: req.user.id }]
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
    if (!isActivityMutationShortcut(req.context)) {
      const previous = (originalDoc ?? {}) as Record<string, unknown>
      const merged = { ...previous, ...(data as Record<string, unknown>) }
      if (
        JSON.stringify(activityStaffFieldSnapshot(previous)) !==
        JSON.stringify(activityStaffFieldSnapshot(merged))
      ) {
        throw new APIError(
          'Lideranças só podem marcar tarefas e registrar atualizações na atividade.',
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
            relationshipId(taskRecord.responsible) !== relationshipId(previousTask.responsible)
          ) {
            throw new APIError('Lideranças só podem marcar tarefas como concluídas.', 403)
          }
        }
      } else if (Array.isArray(data.tasks) && !Array.isArray(originalDoc?.tasks)) {
        throw new APIError('Lideranças não podem adicionar ou remover tarefas.', 403)
      }
    }
  }

  return data
}

export const Activity: CollectionConfig = {
  slug: 'activity',
  labels: {
    singular: 'Atividade',
    plural: 'Atividades',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'title',
    defaultColumns: ['title', 'tags', 'status', 'municipality', 'startAt', 'updatedAt'],
  },
  access: {
    create: canCreateActivity,
    read: canReadActivity,
    update: canUpdateActivity,
    delete: canDeleteActivity,
  },
  hooks: {
    beforeValidate: [
      setCanonicalActivitySlug,
      validateActivitySchedule,
      validateActivityResponsibles,
      validateDeputyPresentTimeGate,
    ],
    beforeChange: [deriveActivityFields],
    afterChange: [
      async ({ doc, req }) => {
        // C14: all activities are visible (no more rascunho).
        const { notifyActivityNeedsAttention } =
          await import('@/utilities/notification/notificationEvents')
        await notifyActivityNeedsAttention(req, doc)
        return doc
      },
      // C114: pushes the official calendar mirror to Google (best-effort —
      // never throws into the write path; failures land in `paused`).
      activityGoogleCalendarSyncHook,
    ],
    afterDelete: [activityGoogleCalendarSyncHook],
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
        create: canSetActivitySystemField,
        update: canSetActivitySystemField,
      },
    },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags',
      hasMany: true,
      index: true,
      admin: {
        description: 'Classificação livre do compromisso (ex.: comício, imprensa, reunião).',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'confirmado',
      index: true,
      access: {
        create: canSetActivityStatus,
        update: canSetActivityStatus,
      },
      options: [...ACTIVITY_STATUS_OPTIONS],
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
        description: 'Marque quando o deputado Jorge Solla estiver presente na atividade.',
      },
    },
    {
      // C104 — all-day commitments (one or several whole days) keep the date
      // granularity the toggle promised: when true, startAt is the first day
      // at 00:00 America/Bahia and endAt the last day at 00:00 (inclusive end;
      // single-day events have startAt === endAt). Conversions to the
      // exclusive end FullCalendar/iCal expect live in lib/activityAllDay.ts.
      name: 'allDay',
      type: 'checkbox',
      label: 'Todo o dia',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Compromisso que ocupa um ou mais dias inteiros, sem horário.',
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
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
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
      // C90 — one polymorphic multi-value field replaces the old `advisors`
      // (staff hasMany), `leadership` (hasOne) and `responsible` (Contact)
      // fields. Anyone conducting the commitment — staff, a leadership or a
      // dobradinha — lives here.
      name: 'responsible',
      type: 'relationship',
      relationTo: ['campaignUser', 'leadership', 'stateDeputy'],
      label: 'Responsáveis',
      hasMany: true,
      index: true,
      access: {
        create: canSetActivityResponsible,
        update: canSetActivityResponsible,
      },
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
            create: canSetActivitySystemField,
            update: canSetActivitySystemField,
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
        create: canSetActivitySystemField,
        update: canSetActivitySystemField,
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
        create: canSetActivitySystemField,
        update: canSetActivitySystemField,
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
            create: canSetActivitySystemField,
            update: canSetActivitySystemField,
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
            create: canSetActivitySystemField,
            update: canSetActivitySystemField,
          },
        },
      ],
    },
    {
      name: 'resultSummary',
      type: 'textarea',
      label: 'Resultado da atividade',
      maxLength: 6000,
      access: {
        create: canSetActivityStatus,
        update: canSetActivityStatus,
      },
      admin: {
        description:
          'O que aconteceu, público, aprendizados. Vira base para futuras atividades no mesmo município.',
      },
    },
    {
      name: 'resultMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Fotos e vídeos do resultado',
      hasMany: true,
      access: {
        create: canSetActivityStatus,
        update: canSetActivityStatus,
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
        create: canSetActivitySystemField,
        update: canSetActivitySystemField,
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
        create: canSetActivitySystemField,
        update: canSetActivitySystemField,
      },
    },
    systemStampedActorField({ label: 'Criada por', setAccess: canSetActivitySystemField }),
  ],
}
