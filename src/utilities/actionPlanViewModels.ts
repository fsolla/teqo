import type { ActionPlan, CampaignUser, Contact, Organization, Plaza } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export type ActionPlanPlazaSummary = {
  id: number
  name: string
  slug: string
}

export const actionPlanPlazaSummary = (
  plaza: ActionPlan['plaza'] | null | undefined,
): ActionPlanPlazaSummary | null =>
  isPopulatedRelationship<Plaza>(plaza)
    ? { id: plaza.id, name: plaza.name, slug: plaza.slug }
    : null

/** Short "where" line, e.g. "Praça de Itabuna · Feira do Malhado". */
export const formatActionPlanLocationLabel = ({
  plazaName,
  locality,
}: {
  plazaName: string | null
  locality?: string | null
}): string => [plazaName, locality].filter(Boolean).join(' · ')

export const actionPlanListSelect = {
  title: true,
  slug: true,
  kind: true,
  status: true,
  deputyPresent: true,
  startAt: true,
  endAt: true,
  plaza: true,
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
  plazaName: string | null
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
  const plazaName = actionPlanPlazaSummary(plan.plaza)?.name ?? null
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    kind: plan.kind,
    status: plan.status,
    deputyPresent: Boolean(plan.deputyPresent),
    startAt: plan.startAt ?? null,
    endAt: plan.endAt ?? null,
    plazaName,
    locality: plan.locality ?? null,
    locationLabel: formatActionPlanLocationLabel({ plazaName, locality: plan.locality }),
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
  plaza: true,
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
  responsible: { id: number; name: string; phone: string } | null
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
  plazaId: number | null
  locality: string | null
  organizationIDs: number[]
  advisorIDs: number[]
  responsible: { id: number; name: string; phone: string } | null
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
  plazaId: relationshipId(plan.plaza),
  locality: plan.locality ?? null,
  organizationIDs: relationshipIds(plan.organizations),
  advisorIDs: relationshipIds(plan.advisors),
  responsible: isPopulatedRelationship<Contact>(plan.responsible)
    ? { id: plan.responsible.id, name: plan.responsible.name, phone: plan.responsible.phone }
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
      ? { id: task.responsible.id, name: task.responsible.name, phone: task.responsible.phone }
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
  plaza: true,
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
  plaza: ActionPlanPlazaSummary | null
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
  plazaSummary: ActionPlanPlazaSummary | null = null,
): ActionPlanDetailViewModel => {
  const plaza = plazaSummary ?? actionPlanPlazaSummary(plan.plaza)
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
    plaza,
    locality: plan.locality ?? null,
    locationLabel: formatActionPlanLocationLabel({
      plazaName: plaza?.name ?? null,
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
