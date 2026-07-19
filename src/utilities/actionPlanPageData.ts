import type { Payload } from 'payload'

import type { ActionPlan, CampaignUser } from '@/payload-types'
import type { ActionPlanDetailTab } from '@/utilities/actionPlanDetailTabUi'
import {
  actionPlanFormSelect,
  actionPlanListSelect,
  getActionPlanDetailSelect,
  toActionPlanFormViewModel,
} from '@/utilities/actionPlanViewModels'
import {
  actionPlanPageSize,
  buildActionPlanListWhere,
  parseActionPlanListParams,
} from '@/utilities/actionPlanUi'

type ActionPlanListSearchParams = Record<string, string | string[] | undefined>

export class ActionPlanNotFoundError extends Error {
  override name = 'ActionPlanNotFoundError'

  constructor() {
    super('Plano de ação não encontrado.')
  }
}

export type AccessibleActionPlanContext = {
  id: number
  slug: string
  document: ActionPlan
}

export const loadActionPlanListPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  searchParams: Promise<ActionPlanListSearchParams> | ActionPlanListSearchParams,
  now = new Date(),
) => {
  const state = parseActionPlanListParams(await searchParams)
  const result = await payload.find({
    collection: 'actionPlan',
    depth: 1,
    limit: actionPlanPageSize,
    page: state.page,
    sort: 'startAt',
    where: buildActionPlanListWhere(state, now),
    select: actionPlanListSelect,
    user,
    overrideAccess: false,
  })

  return { result, state }
}

const getActionPlanDetailQueryDepth = (activeTab: ActionPlanDetailTab): number =>
  activeTab === 'updates' ? 0 : 1

const loadAccessibleActionPlanBySlug = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  planSlug: string,
  select: ReturnType<typeof getActionPlanDetailSelect> | typeof actionPlanFormSelect,
  depth: number,
): Promise<ActionPlan> => {
  const result = await payload.find({
    collection: 'actionPlan',
    where: { slug: { equals: planSlug } },
    depth,
    limit: 1,
    pagination: false,
    select,
    user,
    overrideAccess: false,
  })
  const plan = result.docs[0]
  if (!plan) throw new ActionPlanNotFoundError()
  return plan as ActionPlan
}

export const resolveAccessibleActionPlanContext = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  planSlug: string,
  activeTab: ActionPlanDetailTab = 'overview',
): Promise<AccessibleActionPlanContext> => {
  const document = await loadAccessibleActionPlanBySlug(
    payload,
    user,
    planSlug,
    getActionPlanDetailSelect(activeTab),
    getActionPlanDetailQueryDepth(activeTab),
  )

  return {
    id: document.id,
    slug: document.slug,
    document,
  }
}

export const getActionPlanEditPageData = async (
  payload: Payload,
  user: CampaignUser,
  planSlug: string,
) =>
  toActionPlanFormViewModel(
    await loadAccessibleActionPlanBySlug(payload, user, planSlug, actionPlanFormSelect, 1),
  )
