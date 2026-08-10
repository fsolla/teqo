import { formatAllDayRangeLabel } from '@/lib/activityAllDay'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { isPopulatedRelationship, populatedContactName, relationshipId } from '@/lib/relationship'
import {
  activityResponsibleTypeLabels,
  parseActivityResponsibleEntries,
  type ActivityResponsibleCollection,
  type ActivityResponsibleEntry,
} from '@/lib/schemas/activity'
import type {
  Activity,
  CampaignUser,
  Contact,
  Leadership,
  Municipality,
  Organization,
  StateDeputy,
} from '@/payload-types'
import { canCampaignUserRescheduleActivity } from '@/utilities/access/activities'
import type { ActivityDetailTab } from '@/utilities/activityDetailTabUi'

export type ActivityMunicipalitySummary = {
  id: number
  name: string
  slug: string
}

export const activityMunicipalitySummary = (
  municipality: Activity['municipality'] | null | undefined,
): ActivityMunicipalitySummary | null =>
  isPopulatedRelationship<Municipality>(municipality)
    ? { id: municipality.id, name: municipality.name, slug: municipality.slug }
    : null

// ---------------------------------------------------------------------------
// C90 — polymorphic `responsible` display (typed chips)
// ---------------------------------------------------------------------------

export type ActivityResponsibleDisplay = {
  relationTo: ActivityResponsibleCollection
  id: number
  name: string
  typeLabel: string
}

const responsibleEntryName = (
  relationTo: ActivityResponsibleEntry['relationTo'],
  value: unknown,
): string | null => {
  switch (relationTo) {
    case 'campaignUser':
      return isPopulatedRelationship<CampaignUser>(value) ? value.name : null
    case 'leadership':
      return isPopulatedRelationship<Leadership>(value)
        ? populatedContactName((value as Leadership).contact)
        : null
    case 'stateDeputy':
      return isPopulatedRelationship<StateDeputy>(value)
        ? populatedContactName((value as StateDeputy).contact)
        : null
  }
}

/** Maps a polymorphic `responsible` value (ids or populated docs) to display chips. */
const mapActivityResponsibles = (
  value: readonly unknown[] | null | undefined,
): ActivityResponsibleDisplay[] => {
  const populatedByKey = new Map<string, unknown>()
  for (const raw of Array.isArray(value) ? value : []) {
    const record = raw as { relationTo?: unknown; value?: unknown }
    const id = relationshipId(record.value)
    if (typeof record.relationTo === 'string' && id !== null) {
      populatedByKey.set(`${record.relationTo}:${id}`, record.value)
    }
  }

  return parseActivityResponsibleEntries(value).map((entry) => ({
    relationTo: entry.relationTo,
    id: entry.value,
    name:
      responsibleEntryName(
        entry.relationTo,
        populatedByKey.get(`${entry.relationTo}:${entry.value}`),
      ) ?? `Responsável #${entry.value}`,
    typeLabel: activityResponsibleTypeLabels[entry.relationTo],
  }))
}

export const formatActivityWhenLabel = (
  startAt: string | null | undefined,
  options: { allDay?: boolean | null; endAt?: string | null } = {},
): string => {
  if (!startAt) return 'Data a definir'
  if (options.allDay) return formatAllDayRangeLabel(startAt, options.endAt)
  return formatBahiaDateTimeLabel(startAt)
}

export const formatActivityHomeSearchSecondary = (
  municipalityName: string | null,
  startAt: string | null | undefined,
  options: { allDay?: boolean | null; endAt?: string | null } = {},
): string => {
  const whenLabel = formatActivityWhenLabel(startAt, options)
  if (!municipalityName) return whenLabel
  return `${municipalityName} · ${whenLabel}`
}

/** Short "where" line, e.g. "Itabuna · Feira do Malhado". */
const formatActivityLocationLabel = ({
  municipalityName,
  locality,
}: {
  municipalityName: string | null
  locality?: string | null
}): string => [municipalityName, locality].filter(Boolean).join(' · ')

export const activityAgendaSelect = {
  title: true,
  slug: true,
  tags: true,
  status: true,
  deputyPresent: true,
  allDay: true,
  startAt: true,
  endAt: true,
  municipality: true,
  locality: true,
} as const

export const activityListSelect = {
  ...activityAgendaSelect,
  responsible: true,
  taskDoneCount: true,
  taskTotal: true,
} as const

export type ActivityAgendaEvent = {
  id: number
  title: string
  href: string
  tags: string[]
  status: Activity['status']
  deputyPresent: boolean
  allDay: boolean
  startAt: string
  endAt: string | null
  municipality: ActivityMunicipalitySummary | null
  locality: string | null
  canReschedule: boolean
}

export const toActivityAgendaEvent = (
  activity: Activity,
  user: CampaignUser,
): ActivityAgendaEvent => {
  if (!activity.startAt) {
    throw new Error('Atividade sem data não pode ser convertida em evento de agenda.')
  }

  const deputyPresent = Boolean(activity.deputyPresent)
  return {
    id: activity.id,
    title: activity.title,
    href: `/campanha/atividades/${activity.slug}`,
    tags: activity.tags ?? [],
    status: activity.status,
    deputyPresent,
    allDay: Boolean(activity.allDay),
    startAt: activity.startAt,
    endAt: activity.endAt ?? null,
    municipality: activityMunicipalitySummary(activity.municipality),
    locality: activity.locality ?? null,
    canReschedule: canCampaignUserRescheduleActivity(user, deputyPresent),
  }
}

export type ActivityListViewModel = {
  id: number
  title: string
  slug: string
  tags: string[]
  status: Activity['status']
  deputyPresent: boolean
  allDay: boolean
  startAt: string | null
  endAt: string | null
  municipalityName: string | null
  locality: string | null
  locationLabel: string
  responsibles: ActivityResponsibleDisplay[]
  taskProgress: { done: number; total: number }
}

const relationshipName = (
  relationship: number | Contact | CampaignUser | null | undefined,
): string | null =>
  isPopulatedRelationship<Contact | CampaignUser>(relationship) ? relationship.name : null

export const toActivityListViewModel = (activity: Activity): ActivityListViewModel => {
  const municipalityName = activityMunicipalitySummary(activity.municipality)?.name ?? null
  return {
    id: activity.id,
    title: activity.title,
    slug: activity.slug,
    tags: activity.tags ?? [],
    status: activity.status,
    deputyPresent: Boolean(activity.deputyPresent),
    allDay: Boolean(activity.allDay),
    startAt: activity.startAt ?? null,
    endAt: activity.endAt ?? null,
    municipalityName,
    locality: activity.locality ?? null,
    locationLabel: formatActivityLocationLabel({ municipalityName, locality: activity.locality }),
    responsibles: mapActivityResponsibles(activity.responsible),
    taskProgress: {
      done: activity.taskDoneCount ?? 0,
      total: activity.taskTotal ?? 0,
    },
  }
}

export const activityFormSelect = {
  title: true,
  slug: true,
  tags: true,
  status: true,
  description: true,
  deputyPresent: true,
  allDay: true,
  startAt: true,
  endAt: true,
  municipality: true,
  locality: true,
  organizations: true,
  responsible: true,
  tasks: true,
} as const

type ActivityFormTaskViewModel = {
  id: string | null
  title: string
  responsible: { id: number; name: string; phone: string | null } | null
  due: string | null
  done: boolean
}

export type ActivityFormViewModel = {
  id: number
  title: string
  slug: string
  tags: string[]
  status: Activity['status']
  description: string | null
  deputyPresent: boolean
  allDay: boolean
  startAt: string | null
  endAt: string | null
  municipalityId: number | null
  locality: string | null
  organizationIDs: number[]
  responsibles: ActivityResponsibleDisplay[]
  tasks: ActivityFormTaskViewModel[]
}

const relationshipIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

export const toActivityFormViewModel = (activity: Activity): ActivityFormViewModel => ({
  id: activity.id,
  title: activity.title,
  slug: activity.slug,
  tags: activity.tags ?? [],
  status: activity.status,
  description: activity.description ?? null,
  deputyPresent: Boolean(activity.deputyPresent),
  allDay: Boolean(activity.allDay),
  startAt: activity.startAt ?? null,
  endAt: activity.endAt ?? null,
  municipalityId: relationshipId(activity.municipality),
  locality: activity.locality ?? null,
  organizationIDs: relationshipIds(activity.organizations),
  responsibles: mapActivityResponsibles(activity.responsible),
  tasks: (activity.tasks ?? []).map((task) => ({
    id: task.id ?? null,
    title: task.title,
    responsible: isPopulatedRelationship<Contact>(task.responsible)
      ? {
          id: task.responsible.id,
          name: task.responsible.name,
          phone: task.responsible.phone ?? null,
        }
      : null,
    due: task.due ?? null,
    done: Boolean(task.done),
  })),
})

const activityDetailContextSelect = {
  title: true,
  slug: true,
  tags: true,
  status: true,
  description: true,
  deputyPresent: true,
  allDay: true,
  startAt: true,
  endAt: true,
  municipality: true,
  locality: true,
  organizations: true,
  responsible: true,
  createdBy: true,
  updatedAt: true,
  createdAt: true,
} as const

export const getActivityDetailSelect = (activeTab: ActivityDetailTab) => {
  if (activeTab === 'overview') {
    return {
      ...activityDetailContextSelect,
      taskDoneCount: true,
      taskTotal: true,
      resultSummary: true,
      resultRecordedBy: true,
      resultRecordedAt: true,
    } as const
  }
  if (activeTab === 'tasks') {
    return {
      ...activityDetailContextSelect,
      tasks: true,
    } as const
  }
  return {
    ...activityDetailContextSelect,
    updates: true,
  } as const
}

export type ActivityTaskViewModel = {
  id: string | null
  title: string
  responsibleId: number | null
  responsibleName: string | null
  due: string | null
  done: boolean
  doneAt: string | null
}

export type ActivityUpdateViewModel = {
  id: string | null
  body: string
  authorName: string | null
  createdAt: string | null
}

type ActivityResultViewModel = {
  summary: string
  recordedByName: string | null
  recordedAt: string | null
}

export type ActivityDetailViewModel = {
  id: number
  title: string
  slug: string
  tags: string[]
  status: Activity['status']
  description: string | null
  deputyPresent: boolean
  allDay: boolean
  startAt: string | null
  endAt: string | null
  municipality: ActivityMunicipalitySummary | null
  locality: string | null
  locationLabel: string
  organizations: Array<{ id: number; name: string }>
  responsibles: ActivityResponsibleDisplay[]
  taskProgress: { done: number; total: number }
  tasks: ActivityTaskViewModel[]
  updates: ActivityUpdateViewModel[]
  result: ActivityResultViewModel | null
  createdByName: string | null
  updatedAt: string
  createdAt: string
}

const mapActivityTasks = (activity: Activity): ActivityTaskViewModel[] =>
  (activity.tasks ?? []).map((task) => ({
    id: task.id ?? null,
    title: task.title,
    responsibleId: relationshipId(task.responsible),
    responsibleName: relationshipName(task.responsible),
    due: task.due ?? null,
    done: Boolean(task.done),
    doneAt: task.doneAt ?? null,
  }))

const mapActivityUpdates = (
  activity: Activity,
  authorNamesById: ReadonlyMap<number, string> = new Map(),
): ActivityUpdateViewModel[] =>
  (activity.updates ?? []).map((update) => {
    const authorId = relationshipId(update.author)
    const populatedName = relationshipName(update.author)
    return {
      id: update.id ?? null,
      body: update.body,
      authorName: populatedName ?? (authorId ? (authorNamesById.get(authorId) ?? null) : null),
      createdAt: update.createdAt ?? null,
    }
  })

const mapActivityResult = (activity: Activity): ActivityResultViewModel | null => {
  const summary = activity.resultSummary?.trim()
  if (!summary) return null
  return {
    summary,
    recordedByName: relationshipName(activity.resultRecordedBy),
    recordedAt: activity.resultRecordedAt ?? null,
  }
}

export const toActivityDetailViewModel = (
  activity: Activity,
  activeTab: ActivityDetailTab = 'overview',
  authorNamesById: ReadonlyMap<number, string> = new Map(),
  municipalitySummary: ActivityMunicipalitySummary | null = null,
): ActivityDetailViewModel => {
  const municipality = municipalitySummary ?? activityMunicipalitySummary(activity.municipality)
  return {
    id: activity.id,
    title: activity.title,
    slug: activity.slug,
    tags: activity.tags ?? [],
    status: activity.status,
    description: activity.description ?? null,
    deputyPresent: Boolean(activity.deputyPresent),
    allDay: Boolean(activity.allDay),
    startAt: activity.startAt ?? null,
    endAt: activity.endAt ?? null,
    municipality,
    locality: activity.locality ?? null,
    locationLabel: formatActivityLocationLabel({
      municipalityName: municipality?.name ?? null,
      locality: activity.locality,
    }),
    organizations:
      activity.organizations
        ?.filter((organization): organization is Organization =>
          isPopulatedRelationship<Organization>(organization),
        )
        .map(({ id, name }) => ({ id, name })) ?? [],
    responsibles: mapActivityResponsibles(activity.responsible),
    taskProgress: {
      done: activity.taskDoneCount ?? 0,
      total: activity.taskTotal ?? 0,
    },
    tasks: activeTab === 'tasks' ? mapActivityTasks(activity) : [],
    updates: activeTab === 'updates' ? mapActivityUpdates(activity, authorNamesById) : [],
    result: mapActivityResult(activity),
    createdByName: relationshipName(activity.createdBy),
    updatedAt: activity.updatedAt,
    createdAt: activity.createdAt,
  }
}
