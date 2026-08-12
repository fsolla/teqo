import 'server-only'

import type { Payload } from 'payload'

import type { ActivityAgendaRequestData } from '@/lib/schemas/activity'
import type { Activity, CampaignUser } from '@/payload-types'
import type { ActivityDetailTab } from '@/utilities/activityDetailTabUi'
import {
  activityPageSize,
  buildActivityAgendaWhere,
  buildActivityListWhere,
  parseActivityListParams,
} from '@/utilities/activityUi'
import {
  activityAgendaSelect,
  activityListSelect,
  getActivityDetailSelect,
  toActivityAgendaEvent,
} from '@/utilities/activityViewModels'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'

type ActivityListSearchParams = Record<string, string | string[] | undefined>

export const ActivityNotFoundError = createEntityNotFoundError(
  'Activity',
  'Atividade não encontrada.',
)

export type AccessibleActivityContext = {
  id: number
  slug: string
  document: Activity
}

export const loadActivityListPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  searchParams: Promise<ActivityListSearchParams> | ActivityListSearchParams,
  now = new Date(),
) => {
  const state = parseActivityListParams(await searchParams)
  const result = await payload.find({
    collection: 'activity',
    depth: 1,
    limit: activityPageSize,
    page: state.page,
    sort: 'startAt',
    where: buildActivityListWhere(state, now),
    select: activityListSelect,
    user,
    overrideAccess: false,
  })

  return { result, state }
}

export const loadActivityAgendaEventsData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  request: ActivityAgendaRequestData,
) => {
  const result = await payload.find({
    collection: 'activity',
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'startAt',
    where: buildActivityAgendaWhere(request, request.rangeStart, request.rangeEnd),
    select: activityAgendaSelect,
    user,
    overrideAccess: false,
  })

  return result.docs.map((activity) => toActivityAgendaEvent(activity as Activity, user))
}

export const loadAccessibleActivityTags = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
): Promise<string[]> => {
  const result = await payload.find({
    collection: 'activity',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { tags: true },
    user,
    overrideAccess: false,
  })
  const tags = new Set(result.docs.flatMap((activity) => activity.tags ?? []))
  return [...tags].sort((left, right) => left.localeCompare(right, 'pt-BR'))
}

const getActivityDetailQueryDepth = (activeTab: ActivityDetailTab): number =>
  activeTab === 'updates' ? 0 : 1

const loadAccessibleActivityBySlug = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  activitySlug: string,
  select: ReturnType<typeof getActivityDetailSelect>,
  depth: number,
): Promise<Activity> => {
  const result = await payload.find({
    collection: 'activity',
    where: { slug: { equals: activitySlug } },
    depth,
    limit: 1,
    pagination: false,
    select,
    user,
    overrideAccess: false,
  })
  const activity = result.docs[0]
  if (!activity) throw new ActivityNotFoundError()
  return activity as Activity
}

export const resolveAccessibleActivityContext = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  activitySlug: string,
  activeTab: ActivityDetailTab = 'overview',
): Promise<AccessibleActivityContext> => {
  const document = await loadAccessibleActivityBySlug(
    payload,
    user,
    activitySlug,
    getActivityDetailSelect(activeTab),
    getActivityDetailQueryDepth(activeTab),
  )

  return {
    id: document.id,
    slug: document.slug,
    document,
  }
}
