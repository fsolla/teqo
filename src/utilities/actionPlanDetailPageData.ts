import type { Payload } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import {
  actionPlanPlazaSummary,
  toActionPlanDetailViewModel,
  type ActionPlanDetailViewModel,
  type ActionPlanPlazaSummary,
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

/**
 * Display-name lookup for a plan's plaza when the document was loaded at
 * depth 0 (updates tab). The actor already passed row access on the plan
 * itself, so reading the plaza's name/slug privileged avoids a second
 * per-role access round-trip (established display-name pattern).
 */
const loadActionPlanPlazaSummaryById = async (
  payload: Pick<Payload, 'find'>,
  plazaId: number,
): Promise<ActionPlanPlazaSummary | null> => {
  const result = await payload.find({
    collection: 'plaza',
    where: { id: { equals: plazaId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { name: true, slug: true },
    overrideAccess: true,
  })
  const plaza = result.docs[0]
  return plaza ? { id: plaza.id, name: plaza.name, slug: plaza.slug } : null
}

export const getActionPlanDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleActionPlanContext,
  activeTab: ActionPlanDetailTab,
): Promise<ActionPlanDetailViewModel> => {
  const plazaId = relationshipId(context.document.plaza)
  const plazaSummary =
    actionPlanPlazaSummary(context.document.plaza) ??
    (plazaId ? await loadActionPlanPlazaSummaryById(payload, plazaId) : null)

  const authorNames =
    activeTab === 'updates' && context.document.updates?.length
      ? await loadActionPlanUpdateAuthorNames(payload, user, context.document.updates)
      : new Map<number, string>()

  return toActionPlanDetailViewModel(context.document, activeTab, authorNames, plazaSummary)
}
