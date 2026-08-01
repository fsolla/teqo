import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'

export type ActivityRelationOption = {
  id: number
  label: string
  municipalityId: number
}

export const ACTIVITY_RELATION_SEARCH_LIMIT = 20

const MIN_ACTIVITY_TITLE_QUERY_LENGTH = 2

const isActivityTitleQueryReady = (query: string) =>
  query.trim().length === 0 || query.trim().length >= MIN_ACTIVITY_TITLE_QUERY_LENGTH

const toActivityRelationOption = (activity: {
  id: number
  title: string
  municipality: unknown
}): ActivityRelationOption | null => {
  const municipalityId = relationshipId(activity.municipality)
  if (!municipalityId) return null
  return { id: activity.id, label: activity.title, municipalityId }
}

export const loadActivityRelationOptionById = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  activityId: number,
): Promise<ActivityRelationOption | null> => {
  const result = await payload.find({
    collection: 'activity',
    where: { id: { equals: activityId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { title: true, municipality: true },
    user,
    overrideAccess: false,
  })

  const activity = result.docs[0]
  return activity ? toActivityRelationOption(activity) : null
}

/**
 * Server-backed activity picker for demand forms — scoped to one municipality when set.
 * Empty query returns recent activities in that municipality; typed query filters by title.
 */
export const searchActivityRelationOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  query: string,
  municipalityId: number | null,
): Promise<ActivityRelationOption[]> => {
  if (!municipalityId || !isActivityTitleQueryReady(query)) return []

  const trimmed = query.trim().slice(0, 120)

  const result = await payload.find({
    collection: 'activity',
    where: {
      and: [
        { municipality: { equals: municipalityId } },
        ...(trimmed ? [{ title: { contains: trimmed } }] : []),
      ],
    },
    depth: 0,
    limit: ACTIVITY_RELATION_SEARCH_LIMIT,
    page: 1,
    sort: 'title',
    select: { title: true, municipality: true },
    user,
    overrideAccess: false,
  })

  return result.docs
    .map((activity) => toActivityRelationOption(activity))
    .filter((option): option is ActivityRelationOption => option !== null)
}
