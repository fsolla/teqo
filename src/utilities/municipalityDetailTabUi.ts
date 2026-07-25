export const municipalityDetailTabs = [
  'overview',
  'dossie',
  'elections',
  'leaderships',
  'updates',
  'demands',
] as const

export type MunicipalityDetailTab = (typeof municipalityDetailTabs)[number]
export type MunicipalityDetailSearchParams = Record<string, string | string[] | undefined>

const tabQueryKeys: Record<MunicipalityDetailTab, readonly string[]> = {
  overview: [],
  dossie: [],
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

const isAllowedTab = (value: string | undefined): value is MunicipalityDetailTab =>
  municipalityDetailTabs.includes(value as MunicipalityDetailTab)

export const resolveMunicipalityDetailTab = (
  searchParams: MunicipalityDetailSearchParams,
): MunicipalityDetailTab => {
  if (firstValue(searchParams.newUpdate) === '1') return 'updates'

  const requestedTab = firstValue(searchParams.tab)
  return isAllowedTab(requestedTab) ? requestedTab : 'overview'
}

export const buildMunicipalityDetailTabHref = (
  municipalitySlug: string,
  tab: MunicipalityDetailTab,
  searchParams: MunicipalityDetailSearchParams,
): string => {
  const params = new URLSearchParams()
  for (const key of tabQueryKeys[tab]) {
    appendQueryValue(params, key, searchParams[key])
  }
  params.set('tab', tab)

  return `/campanha/municipios/${municipalitySlug}?${params.toString()}`
}
