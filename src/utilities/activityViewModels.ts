import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { isPopulatedRelationship, relationshipId } from '@/lib/relationship'
import type { ActivityOrigin } from '@/lib/schemas/activity'
import type { Activity, CampaignUser, Contact, Municipality, Organization } from '@/payload-types'
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

export const formatActivityWhenLabel = (startAt: string | null | undefined): string =>
  startAt ? formatBahiaDateTimeLabel(startAt) : 'Data a definir'

export const formatActivityHomeSearchSecondary = (
  municipalityName: string | null,
  startAt: string | null | undefined,
): string => {
  const whenLabel = formatActivityWhenLabel(startAt)
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

export const activityListSelect = {
  title: true,
  slug: true,
  kind: true,
  status: true,
  deputyPresent: true,
  startAt: true,
  endAt: true,
  municipality: true,
  locality: true,
  responsible: true,
  taskDoneCount: true,
  taskTotal: true,
} as const

export type ActivityListViewModel = {
  id: number
  title: string
  slug: string
  kind: Activity['kind']
  status: Activity['status']
  deputyPresent: boolean
  startAt: string | null
  endAt: string | null
  municipalityName: string | null
  locality: string | null
  locationLabel: string
  responsibleName: string | null
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
    kind: activity.kind,
    status: activity.status,
    deputyPresent: Boolean(activity.deputyPresent),
    startAt: activity.startAt ?? null,
    endAt: activity.endAt ?? null,
    municipalityName,
    locality: activity.locality ?? null,
    locationLabel: formatActivityLocationLabel({ municipalityName, locality: activity.locality }),
    responsibleName: relationshipName(activity.responsible),
    taskProgress: {
      done: activity.taskDoneCount ?? 0,
      total: activity.taskTotal ?? 0,
    },
  }
}

export const activityFormSelect = {
  title: true,
  slug: true,
  kind: true,
  origin: true,
  status: true,
  description: true,
  deputyPresent: true,
  startAt: true,
  endAt: true,
  deadline: true,
  municipality: true,
  locality: true,
  organizations: true,
  advisors: true,
  responsible: true,
  leadership: true,
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
  kind: Activity['kind']
  origin: ActivityOrigin
  status: Activity['status']
  description: string | null
  deputyPresent: boolean
  startAt: string | null
  endAt: string | null
  deadline: string | null
  municipalityId: number | null
  locality: string | null
  organizationIDs: number[]
  advisorIDs: number[]
  responsible: { id: number; name: string; phone: string | null } | null
  leadership: { id: number; label: string } | null
  tasks: ActivityFormTaskViewModel[]
  /** OH13 — CAS token for staff update outbox writes. */
  updatedAt: string
}

const relationshipIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : []).map(relationshipId).filter((id): id is number => id !== null)

export const toActivityFormViewModel = (activity: Activity): ActivityFormViewModel => ({
  id: activity.id,
  title: activity.title,
  slug: activity.slug,
  kind: activity.kind,
  origin: activity.origin ?? 'dado',
  status: activity.status,
  description: activity.description ?? null,
  deputyPresent: Boolean(activity.deputyPresent),
  startAt: activity.startAt ?? null,
  endAt: activity.endAt ?? null,
  deadline: activity.deadline ?? null,
  municipalityId: relationshipId(activity.municipality),
  locality: activity.locality ?? null,
  organizationIDs: relationshipIds(activity.organizations),
  advisorIDs: relationshipIds(activity.advisors),
  responsible: isPopulatedRelationship<Contact>(activity.responsible)
    ? {
        id: activity.responsible.id,
        name: activity.responsible.name,
        phone: activity.responsible.phone ?? null,
      }
    : null,
  leadership: (() => {
    const leadershipId = relationshipId(activity.leadership)
    if (!leadershipId) return null
    if (isPopulatedRelationship(activity.leadership)) {
      const contact = activity.leadership.contact
      const contactName = isPopulatedRelationship<Contact>(contact)
        ? contact.name
        : `Liderança #${leadershipId}`
      return { id: leadershipId, label: contactName }
    }
    return { id: leadershipId, label: `Liderança #${leadershipId}` }
  })(),
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
  updatedAt: activity.updatedAt,
})

const activityDetailContextSelect = {
  title: true,
  slug: true,
  kind: true,
  origin: true,
  status: true,
  description: true,
  deputyPresent: true,
  startAt: true,
  endAt: true,
  deadline: true,
  municipality: true,
  locality: true,
  organizations: true,
  advisors: true,
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
  kind: Activity['kind']
  origin: ActivityOrigin
  status: Activity['status']
  description: string | null
  deputyPresent: boolean
  startAt: string | null
  endAt: string | null
  deadline: string | null
  municipality: ActivityMunicipalitySummary | null
  locality: string | null
  locationLabel: string
  organizations: Array<{ id: number; name: string }>
  advisors: Array<{ id: number; name: string }>
  responsibleId: number | null
  responsibleName: string | null
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
    kind: activity.kind,
    origin: activity.origin ?? 'dado',
    status: activity.status,
    description: activity.description ?? null,
    deputyPresent: Boolean(activity.deputyPresent),
    startAt: activity.startAt ?? null,
    endAt: activity.endAt ?? null,
    deadline: activity.deadline ?? null,
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
    advisors:
      activity.advisors
        ?.filter((advisor): advisor is CampaignUser =>
          isPopulatedRelationship<CampaignUser>(advisor),
        )
        .map(({ id, name }) => ({ id, name })) ?? [],
    responsibleId: relationshipId(activity.responsible),
    responsibleName: relationshipName(activity.responsible),
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
