import type { ActionPlan, CampaignUser, Contact, Organization, Municipality } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export type ActionPlanMunicipalitySummary = {
  id: number
  name: string
  slug: string
}

export const actionPlanMunicipalitySummary = (
  municipality: ActionPlan['municipality'] | null | undefined,
): ActionPlanMunicipalitySummary | null =>
  isPopulatedRelationship<Municipality>(municipality)
    ? { id: municipality.id, name: municipality.name, slug: municipality.slug }
    : null

/** Short "where" line, e.g. "Praça de Itabuna · Feira do Malhado". */
export const formatActionPlanLocationLabel = ({
  municipalityName,
  locality,
}: {
  municipalityName: string | null
  locality?: string | null
}): string => [municipalityName, locality].filter(Boolean).join(' · ')

export const actionPlanListSelect = {
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

export type ActionPlanListViewModel = {
  id: number
  title: string
  slug: string
  kind: ActionPlan['kind']
  status: ActionPlan['status']
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

export const toActionPlanListViewModel = (plan: ActionPlan): ActionPlanListViewModel => {
  const municipalityName = actionPlanMunicipalitySummary(plan.municipality)?.name ?? null
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    kind: plan.kind,
    status: plan.status,
    deputyPresent: Boolean(plan.deputyPresent),
    startAt: plan.startAt ?? null,
    endAt: plan.endAt ?? null,
    municipalityName,
    locality: plan.locality ?? null,
    locationLabel: formatActionPlanLocationLabel({ municipalityName, locality: plan.locality }),
    responsibleName: relationshipName(plan.responsible),
    taskProgress: {
      done: plan.taskDoneCount ?? 0,
      total: plan.taskTotal ?? 0,
    },
  }
}

export const actionPlanFormSelect = {
  title: true,
  slug: true,
  kind: true,
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

export type ActionPlanFormTaskViewModel = {
  id: string | null
  title: string
  responsible: { id: number; name: string; phone: string | null } | null
  due: string | null
  done: boolean
}

export type ActionPlanFormViewModel = {
  id: number
  title: string
  slug: string
  kind: ActionPlan['kind']
  status: ActionPlan['status']
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
  tasks: ActionPlanFormTaskViewModel[]
}

const relationshipIds = (value: unknown): number[] =>
  (Array.isArray(value) ? value : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)

export const toActionPlanFormViewModel = (plan: ActionPlan): ActionPlanFormViewModel => ({
  id: plan.id,
  title: plan.title,
  slug: plan.slug,
  kind: plan.kind,
  status: plan.status,
  description: plan.description ?? null,
  deputyPresent: Boolean(plan.deputyPresent),
  startAt: plan.startAt ?? null,
  endAt: plan.endAt ?? null,
  deadline: plan.deadline ?? null,
  municipalityId: relationshipId(plan.municipality),
  locality: plan.locality ?? null,
  organizationIDs: relationshipIds(plan.organizations),
  advisorIDs: relationshipIds(plan.advisors),
  responsible: isPopulatedRelationship<Contact>(plan.responsible)
    ? {
        id: plan.responsible.id,
        name: plan.responsible.name,
        phone: plan.responsible.phone ?? null,
      }
    : null,
  leadership: (() => {
    const leadershipId = relationshipId(plan.leadership)
    if (!leadershipId) return null
    if (isPopulatedRelationship(plan.leadership)) {
      const contact = plan.leadership.contact
      const contactName = isPopulatedRelationship<Contact>(contact)
        ? contact.name
        : `Liderança #${leadershipId}`
      return { id: leadershipId, label: contactName }
    }
    return { id: leadershipId, label: `Liderança #${leadershipId}` }
  })(),
  tasks: (plan.tasks ?? []).map((task) => ({
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

export const actionPlanDetailContextSelect = {
  title: true,
  slug: true,
  kind: true,
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

export const getActionPlanDetailSelect = (activeTab: ActionPlanDetailTab) => {
  if (activeTab === 'overview') {
    return {
      ...actionPlanDetailContextSelect,
      taskDoneCount: true,
      taskTotal: true,
      resultSummary: true,
      resultRecordedBy: true,
      resultRecordedAt: true,
    } as const
  }
  if (activeTab === 'tasks') {
    return {
      ...actionPlanDetailContextSelect,
      tasks: true,
    } as const
  }
  return {
    ...actionPlanDetailContextSelect,
    updates: true,
  } as const
}

export type ActionPlanTaskViewModel = {
  id: string | null
  title: string
  responsibleId: number | null
  responsibleName: string | null
  due: string | null
  done: boolean
  doneAt: string | null
}

export type ActionPlanUpdateViewModel = {
  id: string | null
  body: string
  authorName: string | null
  createdAt: string | null
}

export type ActionPlanResultViewModel = {
  summary: string
  recordedByName: string | null
  recordedAt: string | null
}

export type ActionPlanDetailViewModel = {
  id: number
  title: string
  slug: string
  kind: ActionPlan['kind']
  status: ActionPlan['status']
  description: string | null
  deputyPresent: boolean
  startAt: string | null
  endAt: string | null
  deadline: string | null
  municipality: ActionPlanMunicipalitySummary | null
  locality: string | null
  locationLabel: string
  organizations: Array<{ id: number; name: string }>
  advisors: Array<{ id: number; name: string }>
  responsibleId: number | null
  responsibleName: string | null
  taskProgress: { done: number; total: number }
  tasks: ActionPlanTaskViewModel[]
  updates: ActionPlanUpdateViewModel[]
  result: ActionPlanResultViewModel | null
  createdByName: string | null
  updatedAt: string
  createdAt: string
}

const mapActionPlanTasks = (plan: ActionPlan): ActionPlanTaskViewModel[] =>
  (plan.tasks ?? []).map((task) => ({
    id: task.id ?? null,
    title: task.title,
    responsibleId: relationshipId(task.responsible),
    responsibleName: relationshipName(task.responsible),
    due: task.due ?? null,
    done: Boolean(task.done),
    doneAt: task.doneAt ?? null,
  }))

const mapActionPlanUpdates = (
  plan: ActionPlan,
  authorNamesById: ReadonlyMap<number, string> = new Map(),
): ActionPlanUpdateViewModel[] =>
  (plan.updates ?? []).map((update) => {
    const authorId = relationshipId(update.author)
    const populatedName = relationshipName(update.author)
    return {
      id: update.id ?? null,
      body: update.body,
      authorName:
        populatedName ?? (authorId ? (authorNamesById.get(authorId) ?? null) : null),
      createdAt: update.createdAt ?? null,
    }
  })

const mapActionPlanResult = (plan: ActionPlan): ActionPlanResultViewModel | null => {
  const summary = plan.resultSummary?.trim()
  if (!summary) return null
  return {
    summary,
    recordedByName: relationshipName(plan.resultRecordedBy),
    recordedAt: plan.resultRecordedAt ?? null,
  }
}

export const toActionPlanDetailViewModel = (
  plan: ActionPlan,
  activeTab: ActionPlanDetailTab = 'overview',
  authorNamesById: ReadonlyMap<number, string> = new Map(),
  municipalitySummary: ActionPlanMunicipalitySummary | null = null,
): ActionPlanDetailViewModel => {
  const municipality = municipalitySummary ?? actionPlanMunicipalitySummary(plan.municipality)
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    kind: plan.kind,
    status: plan.status,
    description: plan.description ?? null,
    deputyPresent: Boolean(plan.deputyPresent),
    startAt: plan.startAt ?? null,
    endAt: plan.endAt ?? null,
    deadline: plan.deadline ?? null,
    municipality,
    locality: plan.locality ?? null,
    locationLabel: formatActionPlanLocationLabel({
      municipalityName: municipality?.name ?? null,
      locality: plan.locality,
    }),
    organizations:
      plan.organizations
        ?.filter((organization): organization is Organization =>
          isPopulatedRelationship<Organization>(organization),
        )
        .map(({ id, name }) => ({ id, name })) ?? [],
    advisors:
      plan.advisors
        ?.filter((advisor): advisor is CampaignUser =>
          isPopulatedRelationship<CampaignUser>(advisor),
        )
        .map(({ id, name }) => ({ id, name })) ?? [],
    responsibleId: relationshipId(plan.responsible),
    responsibleName: relationshipName(plan.responsible),
    taskProgress: {
      done: plan.taskDoneCount ?? 0,
      total: plan.taskTotal ?? 0,
    },
    tasks: activeTab === 'tasks' ? mapActionPlanTasks(plan) : [],
    updates:
      activeTab === 'updates' ? mapActionPlanUpdates(plan, authorNamesById) : [],
    result: mapActionPlanResult(plan),
    createdByName: relationshipName(plan.createdBy),
    updatedAt: plan.updatedAt,
    createdAt: plan.createdAt,
  }
}
