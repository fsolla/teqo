export const actionPlanDetailTabs = ['overview', 'tasks', 'updates'] as const

export type ActionPlanDetailTab = (typeof actionPlanDetailTabs)[number]
export type ActionPlanDetailSearchParams = Record<string, string | string[] | undefined>

const tabQueryKeys: Record<ActionPlanDetailTab, readonly string[]> = {
  overview: [],
  tasks: [],
  updates: ['newUpdate'],
}

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const appendQueryValue = (
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
) => {
  for (const item of Array.isArray(value) ? value : [value]) {
    if (item !== undefined) params.append(key, item)
  }
}

const isAllowedTab = (value: string | undefined): value is ActionPlanDetailTab =>
  actionPlanDetailTabs.includes(value as ActionPlanDetailTab)

export const resolveActionPlanDetailTab = (
  searchParams: ActionPlanDetailSearchParams,
): ActionPlanDetailTab => {
  if (firstValue(searchParams.newUpdate) === '1') return 'updates'

  const requestedTab = firstValue(searchParams.tab)
  return isAllowedTab(requestedTab) ? requestedTab : 'overview'
}

export const buildActionPlanDetailTabHref = (
  planSlug: string,
  tab: ActionPlanDetailTab,
  searchParams: ActionPlanDetailSearchParams,
): string => {
  const params = new URLSearchParams()
  for (const key of tabQueryKeys[tab]) {
    appendQueryValue(params, key, searchParams[key])
  }
  params.set('tab', tab)

  return `/campanha/planos/${planSlug}?${params.toString()}`
}

export const getActionPlanDetailTabRedirect = (
  planSlug: string,
  searchParams: ActionPlanDetailSearchParams,
): string | null => {
  const activeTab = resolveActionPlanDetailTab(searchParams)
  const requestedTab = searchParams.tab
  if (typeof requestedTab === 'string' && requestedTab === activeTab) return null

  return buildActionPlanDetailTabHref(planSlug, activeTab, searchParams)
}
