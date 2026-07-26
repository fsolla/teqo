import { createDetailTabHelpers, type DetailTabSearchParams } from '@/utilities/detailTabUi'

export const activityDetailTabs = ['overview', 'tasks', 'updates'] as const

export type ActivityDetailTab = (typeof activityDetailTabs)[number]
export type ActivityDetailSearchParams = DetailTabSearchParams

const helpers = createDetailTabHelpers<ActivityDetailTab>({
  tabs: activityDetailTabs,
  defaultTab: 'overview',
  tabQueryKeys: {
    overview: [],
    tasks: [],
    updates: ['newUpdate'],
  },
  basePath: (activitySlug) => `/campanha/atividades/${activitySlug}`,
  forcedTab: (searchParams) =>
    (Array.isArray(searchParams.newUpdate) ? searchParams.newUpdate[0] : searchParams.newUpdate) ===
    '1'
      ? 'updates'
      : null,
})

export const resolveActivityDetailTab = helpers.resolveTab
export const buildActivityDetailTabHref = helpers.buildTabHref
export const getActivityDetailTabRedirect = helpers.getTabRedirect
