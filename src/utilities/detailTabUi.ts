/**
 * Shared factory behind the detail-page tab helpers (município, plano de
 * ação): querystring-tab resolution with per-tab preserved params and
 * canonical hrefs. Each detail page declares its config in its own
 * `*DetailTabUi.ts` module and re-exports the generated helpers.
 */
export type DetailTabSearchParams = Record<string, string | string[] | undefined>

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

export const createDetailTabHelpers = <Tab extends string>({
  tabs,
  defaultTab,
  tabQueryKeys,
  basePath,
  forcedTab,
}: {
  tabs: readonly Tab[]
  defaultTab: Tab
  /** Query params each tab preserves when linked to. */
  tabQueryKeys: Record<Tab, readonly string[]>
  basePath: (slug: string) => string
  /** Params that force a tab regardless of `?tab=` (e.g. `?newUpdate=1`). */
  forcedTab?: (searchParams: DetailTabSearchParams) => Tab | null
}) => {
  const isAllowedTab = (value: string | undefined): value is Tab =>
    tabs.includes(value as Tab)

  const resolveTab = (searchParams: DetailTabSearchParams): Tab => {
    const forced = forcedTab?.(searchParams)
    if (forced) return forced

    const requestedTab = firstValue(searchParams.tab)
    return isAllowedTab(requestedTab) ? requestedTab : defaultTab
  }

  const buildTabHref = (
    slug: string,
    tab: Tab,
    searchParams: DetailTabSearchParams,
  ): string => {
    const params = new URLSearchParams()
    for (const key of tabQueryKeys[tab]) {
      appendQueryValue(params, key, searchParams[key])
    }
    params.set('tab', tab)

    return `${basePath(slug)}?${params.toString()}`
  }

  const getTabRedirect = (slug: string, searchParams: DetailTabSearchParams): string | null => {
    const activeTab = resolveTab(searchParams)
    const requestedTab = searchParams.tab
    if (typeof requestedTab === 'string' && requestedTab === activeTab) return null

    return buildTabHref(slug, activeTab, searchParams)
  }

  return { resolveTab, buildTabHref, getTabRedirect }
}
