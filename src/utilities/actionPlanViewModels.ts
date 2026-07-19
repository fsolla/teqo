import type { ActionPlan, CampaignUser, Contact } from '@/payload-types'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

const asStringArray = (value: string[] | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const formatActionPlanTerritoryLabel = ({
  neighborhoods = [],
  locality,
  cities = [],
  regions = [],
}: {
  neighborhoods?: string[] | null
  locality?: string | null
  cities?: string[] | null
  regions?: string[] | null
}): string =>
  [
    (neighborhoods ?? []).join(', '),
    locality,
    (cities ?? []).join(', '),
    (regions ?? []).join(', '),
  ]
    .filter(Boolean)
    .join(' · ')

export const actionPlanListSelect = {
  title: true,
  slug: true,
  kind: true,
  status: true,
  startAt: true,
  endAt: true,
  regions: true,
  cities: true,
  neighborhoods: true,
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
  startAt: string | null
  endAt: string | null
  territoryLabel: string
  city: string | null
  responsibleName: string | null
  taskProgress: { done: number; total: number }
}

const relationshipName = (
  relationship: number | Contact | CampaignUser | null | undefined,
): string | null =>
  isPopulatedRelationship<Contact | CampaignUser>(relationship) ? relationship.name : null

export const toActionPlanListViewModel = (plan: ActionPlan): ActionPlanListViewModel => {
  const cities = asStringArray(plan.cities)
  return {
    id: plan.id,
    title: plan.title,
    slug: plan.slug,
    kind: plan.kind,
    status: plan.status,
    startAt: plan.startAt ?? null,
    endAt: plan.endAt ?? null,
    territoryLabel: formatActionPlanTerritoryLabel(plan),
    city: cities[0] ?? null,
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
  startAt: true,
  endAt: true,
  deadline: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  territoryNotes: true,
  coordinators: true,
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
  startAt: string | null
  endAt: string | null
  deadline: string | null
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  territoryNotes: string | null
  coordinators: Array<{ id: number; name: string }>
  responsible: { id: number; name: string; phone: string } | null
  leadership: { id: number; label: string } | null
  tasks: ActionPlanFormTaskViewModel[]
}

export const toActionPlanFormViewModel = (plan: ActionPlan): ActionPlanFormViewModel => ({
  id: plan.id,
  title: plan.title,
  slug: plan.slug,
  kind: plan.kind,
  status: plan.status,
  description: plan.description ?? null,
  startAt: plan.startAt ?? null,
  endAt: plan.endAt ?? null,
  deadline: plan.deadline ?? null,
  regions: asStringArray(plan.regions),
  cities: asStringArray(plan.cities),
  neighborhoods: asStringArray(plan.neighborhoods),
  locality: plan.locality ?? null,
  territoryNotes: plan.territoryNotes ?? null,
  coordinators:
    plan.coordinators
      ?.filter((coordinator): coordinator is CampaignUser =>
        isPopulatedRelationship<CampaignUser>(coordinator),
      )
      .map(({ id, name }) => ({ id, name })) ?? [],
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

export const actionPlanDetailSelect = {
  title: true,
  slug: true,
  kind: true,
  status: true,
  description: true,
  startAt: true,
  endAt: true,
  deadline: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  territoryNotes: true,
  coordinators: true,
  responsible: true,
  tasks: true,
  updates: true,
  createdBy: true,
  updatedAt: true,
  createdAt: true,
} as const

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

export type ActionPlanDetailViewModel = {
  id: number
  title: string
  slug: string
  kind: ActionPlan['kind']
  status: ActionPlan['status']
  description: string | null
  startAt: string | null
  endAt: string | null
  deadline: string | null
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  territoryNotes: string | null
  territoryLabel: string
  coordinators: Array<{ id: number; name: string }>
  responsibleId: number | null
  responsibleName: string | null
  tasks: ActionPlanTaskViewModel[]
  updates: ActionPlanUpdateViewModel[]
  createdByName: string | null
  updatedAt: string
  createdAt: string
}

export const toActionPlanDetailViewModel = (plan: ActionPlan): ActionPlanDetailViewModel => ({
  id: plan.id,
  title: plan.title,
  slug: plan.slug,
  kind: plan.kind,
  status: plan.status,
  description: plan.description ?? null,
  startAt: plan.startAt ?? null,
  endAt: plan.endAt ?? null,
  deadline: plan.deadline ?? null,
  regions: asStringArray(plan.regions),
  cities: asStringArray(plan.cities),
  neighborhoods: asStringArray(plan.neighborhoods),
  locality: plan.locality ?? null,
  territoryNotes: plan.territoryNotes ?? null,
  territoryLabel: formatActionPlanTerritoryLabel(plan),
  coordinators:
    plan.coordinators
      ?.filter((coordinator): coordinator is CampaignUser =>
        isPopulatedRelationship<CampaignUser>(coordinator),
      )
      .map(({ id, name }) => ({ id, name })) ?? [],
  responsibleId: relationshipId(plan.responsible),
  responsibleName: relationshipName(plan.responsible),
  tasks: (plan.tasks ?? []).map((task) => ({
    id: task.id ?? null,
    title: task.title,
    responsibleId: relationshipId(task.responsible),
    responsibleName: relationshipName(task.responsible),
    due: task.due ?? null,
    done: Boolean(task.done),
    doneAt: task.doneAt ?? null,
  })),
  updates: (plan.updates ?? []).map((update) => ({
    id: update.id ?? null,
    body: update.body,
    authorName: relationshipName(update.author),
    createdAt: update.createdAt ?? null,
  })),
  createdByName: relationshipName(plan.createdBy),
  updatedAt: plan.updatedAt,
  createdAt: plan.createdAt,
})
