import type { Payload, Where } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'
import { relationshipId } from '@/utilities/relationship'

export const actionPlanUpcomingPreviewLimit = 3

const upcomingActionPlanSelect = {
  title: true,
  slug: true,
  kind: true,
  startAt: true,
  municipality: true,
} as const

export type ActionPlanUpcomingPreviewRecord = {
  id: number
  slug: string
  title: string
  kind: ActionPlan['kind']
  startAt: string
  municipalityName: string | null
}

export type ActionPlanUpcomingPreviewFilters = {
  municipality?: number
}

const loadMunicipalityNamesById = async (
  payload: Pick<Payload, 'find'>,
  municipalityIds: number[],
): Promise<Map<number, string>> => {
  if (municipalityIds.length === 0) return new Map()

  // Display-name lookup: row access on the plans already gated visibility.
  const result = await payload.find({
    collection: 'municipality',
    where: { id: { in: municipalityIds } },
    depth: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })

  return new Map(result.docs.map((municipality) => [municipality.id, municipality.name]))
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
  if (options.filters?.municipality) {
    filters.push({ municipality: { equals: options.filters.municipality } })
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

  const municipalityIds = [
    ...new Set(
      result.docs
        .map((plan) => relationshipId(plan.municipality))
        .filter((id): id is number => id !== null),
    ),
  ]
  const municipalityNamesById = await loadMunicipalityNamesById(payload, municipalityIds)

  return result.docs.map((plan) => {
    const municipalityId = relationshipId(plan.municipality)
    return {
      id: plan.id,
      slug: plan.slug,
      title: plan.title,
      kind: plan.kind,
      startAt: plan.startAt as string,
      municipalityName: municipalityId ? (municipalityNamesById.get(municipalityId) ?? null) : null,
    }
  })
}
