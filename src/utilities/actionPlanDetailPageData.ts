import type { Payload } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import {
  toActionPlanDetailViewModel,
  type ActionPlanDetailViewModel,
} from '@/utilities/actionPlanViewModels'
import { relationshipId } from '@/utilities/relationship'
import type { AccessibleActionPlanContext } from '@/utilities/actionPlanPageData'

const loadActionPlanUpdateAuthorNames = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  updates: NonNullable<ActionPlan['updates']>,
): Promise<Map<number, string>> => {
  const authorIds = [
    ...new Set(
      updates
        .map((update) => relationshipId(update.author))
        .filter((id): id is number => id !== null),
    ),
  ]

  if (authorIds.length === 0) return new Map()

  const result = await payload.find({
    collection: 'campaignUser',
    where: { id: { in: authorIds } },
    depth: 0,
    pagination: false,
    select: { name: true },
    user,
    overrideAccess: false,
  })

  return new Map(result.docs.map((author) => [author.id, author.name]))
}

export const getActionPlanDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleActionPlanContext,
  activeTab: ActionPlanDetailTab,
): Promise<ActionPlanDetailViewModel> => {
  if (activeTab === 'updates' && context.document.updates?.length) {
    const authorNames = await loadActionPlanUpdateAuthorNames(
      payload,
      user,
      context.document.updates,
    )
    return toActionPlanDetailViewModel(context.document, activeTab, authorNames)
  }

  return toActionPlanDetailViewModel(context.document, activeTab)
}
