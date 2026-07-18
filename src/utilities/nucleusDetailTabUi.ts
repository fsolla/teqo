export const nucleusDetailTabs = [
  'overview',
  'territory',
  'electorate',
  'leaderships',
  'updates',
] as const

export type NucleusDetailTab = (typeof nucleusDetailTabs)[number]
export type NucleusDetailKind = 'staff' | 'leadership'
export type NucleusDetailSearchParams = Record<string, string | string[] | undefined>

const commonQueryKeys = ['assignCoordinators'] as const
const tabQueryKeys: Record<NucleusDetailTab, readonly string[]> = {
  overview: [],
  territory: [],
  electorate: [],
  leaderships: [
    'leadershipQ',
    'leadershipStatus',
    'leadershipSector',
    'leadershipPage',
    'leadership',
    'editLeadership',
    'newLeadership',
  ],
  updates: ['updateKind', 'updatePage', 'newUpdate'],
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

const isAllowedTab = (
  value: string | undefined,
  nucleusKind: NucleusDetailKind,
): value is NucleusDetailTab =>
  nucleusDetailTabs.includes(value as NucleusDetailTab) &&
  (value !== 'electorate' || nucleusKind === 'staff')

export const resolveNucleusDetailTab = (
  searchParams: NucleusDetailSearchParams,
  nucleusKind: NucleusDetailKind,
): NucleusDetailTab => {
  if (firstValue(searchParams.newLeadership) === '1') return 'leaderships'
  if (firstValue(searchParams.newUpdate) === '1') return 'updates'

  const requestedTab = firstValue(searchParams.tab)
  return isAllowedTab(requestedTab, nucleusKind) ? requestedTab : 'overview'
}

export const buildNucleusDetailTabHref = (
  nucleusSlug: string,
  tab: NucleusDetailTab,
  searchParams: NucleusDetailSearchParams,
): string => {
  const params = new URLSearchParams()
  for (const key of [...commonQueryKeys, ...tabQueryKeys[tab]]) {
    appendQueryValue(params, key, searchParams[key])
  }
  params.set('tab', tab)

  return `/campanha/nucleos/${nucleusSlug}?${params.toString()}`
}

export const getNucleusDetailTabRedirect = (
  nucleusSlug: string,
  searchParams: NucleusDetailSearchParams,
  nucleusKind: NucleusDetailKind,
): string | null => {
  const activeTab = resolveNucleusDetailTab(searchParams, nucleusKind)
  const requestedTab = searchParams.tab
  if (typeof requestedTab === 'string' && requestedTab === activeTab) return null

  return buildNucleusDetailTabHref(nucleusSlug, activeTab, searchParams)
}
