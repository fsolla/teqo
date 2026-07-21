export const plazaDetailTabs = [
  'overview',
  'elections',
  'leaderships',
  'updates',
  'demands',
] as const

export type PlazaDetailTab = (typeof plazaDetailTabs)[number]
export type PlazaDetailSearchParams = Record<string, string | string[] | undefined>

const tabQueryKeys: Record<PlazaDetailTab, readonly string[]> = {
  overview: [],
  elections: ['compare'],
  leaderships: ['leadershipQ', 'leadershipPage'],
  updates: ['updateKind', 'updatePage', 'newUpdate'],
  demands: ['demandStatus'],
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

export type PlazaDetailRoleKind = 'staff' | 'leader'

export const plazaDetailTabsForRole = (roleKind: PlazaDetailRoleKind): PlazaDetailTab[] =>
  roleKind === 'staff'
    ? [...plazaDetailTabs]
    : plazaDetailTabs.filter((tab) => tab !== 'leaderships')

const isAllowedTab = (
  value: string | undefined,
  roleKind: PlazaDetailRoleKind,
): value is PlazaDetailTab => plazaDetailTabsForRole(roleKind).includes(value as PlazaDetailTab)

export const resolvePlazaDetailTab = (
  searchParams: PlazaDetailSearchParams,
  roleKind: PlazaDetailRoleKind,
): PlazaDetailTab => {
  if (firstValue(searchParams.newUpdate) === '1') return 'updates'

  const requestedTab = firstValue(searchParams.tab)
  return isAllowedTab(requestedTab, roleKind) ? requestedTab : 'overview'
}

export const buildPlazaDetailTabHref = (
  plazaSlug: string,
  tab: PlazaDetailTab,
  searchParams: PlazaDetailSearchParams,
): string => {
  const params = new URLSearchParams()
  for (const key of tabQueryKeys[tab]) {
    appendQueryValue(params, key, searchParams[key])
  }
  params.set('tab', tab)

  return `/campanha/pracas/${plazaSlug}?${params.toString()}`
}
