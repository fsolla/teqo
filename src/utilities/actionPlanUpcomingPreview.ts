import type { Payload, Where } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'

export const actionPlanUpcomingPreviewLimit = 3

const upcomingActionPlanSelect = {
  title: true,
  slug: true,
  kind: true,
  startAt: true,
  cities: true,
} as const

export type ActionPlanUpcomingPreviewRecord = {
  id: number
  slug: string
  title: string
  kind: ActionPlan['kind']
  startAt: string
  city: string | null
}

export type ActionPlanUpcomingPreviewFilters = {
  region?: string
  city?: string
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
  if (options.filters?.region) {
    filters.push({ regions: { equals: options.filters.region } })
  }
  if (options.filters?.city) {
    filters.push({ cities: { equals: options.filters.city } })
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

  return result.docs.map((plan) => ({
    id: plan.id,
    slug: plan.slug,
    title: plan.title,
    kind: plan.kind,
    startAt: plan.startAt as string,
    city: Array.isArray(plan.cities) && plan.cities.length > 0 ? plan.cities[0] : null,
  }))
}
