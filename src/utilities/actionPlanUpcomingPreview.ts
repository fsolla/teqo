import type { Payload, Where } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'
import { relationshipId } from '@/utilities/relationship'

export const actionPlanUpcomingPreviewLimit = 3

const upcomingActionPlanSelect = {
  title: true,
  slug: true,
  kind: true,
  startAt: true,
  plaza: true,
} as const

export type ActionPlanUpcomingPreviewRecord = {
  id: number
  slug: string
  title: string
  kind: ActionPlan['kind']
  startAt: string
  plazaName: string | null
}

export type ActionPlanUpcomingPreviewFilters = {
  plaza?: number
}

const loadPlazaNamesById = async (
  payload: Pick<Payload, 'find'>,
  plazaIds: number[],
): Promise<Map<number, string>> => {
  if (plazaIds.length === 0) return new Map()

  // Display-name lookup: row access on the plans already gated visibility.
  const result = await payload.find({
    collection: 'plaza',
    where: { id: { in: plazaIds } },
    depth: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })

  return new Map(result.docs.map((plaza) => [plaza.id, plaza.name]))
}

export const loadUpcomingActionPlansPreview = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  now: Date,
  options: {
    limit?: number
    filters?: ActionPlanUpcomingPreviewFilters
  } = {},
): Promise<ActionPlanUpcomingPreviewRecord[]> => {
  const limit = options.limit ?? actionPlanUpcomingPreviewLimit
  const filters: Where[] = [
    { status: { in: ['planejado', 'confirmado'] } },
    { startAt: { greater_than_equal: now.toISOString() } },
  ]
  if (options.filters?.plaza) {
    filters.push({ plaza: { equals: options.filters.plaza } })
  }

  const result = await payload.find({
    collection: 'actionPlan',
    where: { and: filters },
    depth: 0,
    limit,
    page: 1,
    sort: 'startAt',
    select: upcomingActionPlanSelect,
    user,
    overrideAccess: false,
  })

  const plazaIds = [
    ...new Set(
      result.docs
        .map((plan) => relationshipId(plan.plaza))
        .filter((id): id is number => id !== null),
    ),
  ]
  const plazaNamesById = await loadPlazaNamesById(payload, plazaIds)

  return result.docs.map((plan) => {
    const plazaId = relationshipId(plan.plaza)
    return {
      id: plan.id,
      slug: plan.slug,
      title: plan.title,
      kind: plan.kind,
      startAt: plan.startAt as string,
      plazaName: plazaId ? (plazaNamesById.get(plazaId) ?? null) : null,
    }
  })
}
