import 'server-only'

import type { Payload } from 'payload'

import type { Activity, CampaignUser } from '@/payload-types'
import type { ActivityDetailTab } from '@/utilities/activityDetailTabUi'
import {
  activityPageSize,
  buildActivityListWhere,
  parseActivityListParams,
} from '@/utilities/activityUi'
import {
  activityFormSelect,
  activityListSelect,
  getActivityDetailSelect,
  toActivityFormViewModel,
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

const getActivityDetailQueryDepth = (activeTab: ActivityDetailTab): number =>
  activeTab === 'updates' ? 0 : 1

const loadAccessibleActivityBySlug = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  activitySlug: string,
  select: ReturnType<typeof getActivityDetailSelect> | typeof activityFormSelect,
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

export const getActivityEditPageData = async (
  payload: Payload,
  user: CampaignUser,
  activitySlug: string,
) =>
  toActivityFormViewModel(
    await loadAccessibleActivityBySlug(payload, user, activitySlug, activityFormSelect, 1),
  )
