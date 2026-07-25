import { createDetailTabHelpers, type DetailTabSearchParams } from '@/utilities/detailTabUi'

export const actionPlanDetailTabs = ['overview', 'tasks', 'updates'] as const

export type ActionPlanDetailTab = (typeof actionPlanDetailTabs)[number]
export type ActionPlanDetailSearchParams = DetailTabSearchParams

const helpers = createDetailTabHelpers<ActionPlanDetailTab>({
  tabs: actionPlanDetailTabs,
  defaultTab: 'overview',
  tabQueryKeys: {
    overview: [],
    tasks: [],
    updates: ['newUpdate'],
  },
  basePath: (planSlug) => `/campanha/planos/${planSlug}`,
  forcedTab: (searchParams) =>
    (Array.isArray(searchParams.newUpdate) ? searchParams.newUpdate[0] : searchParams.newUpdate) ===
    '1'
      ? 'updates'
      : null,
})

export const resolveActionPlanDetailTab = helpers.resolveTab
export const buildActionPlanDetailTabHref = helpers.buildTabHref
export const getActionPlanDetailTabRedirect = helpers.getTabRedirect
