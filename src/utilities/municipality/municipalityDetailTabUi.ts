import { createDetailTabHelpers, type DetailTabSearchParams } from '@/utilities/detailTabUi'

export const municipalityDetailTabs = [
  'overview',
  'dossie',
  'elections',
  'leaderships',
  'updates',
  'demands',
] as const

export type MunicipalityDetailTab = (typeof municipalityDetailTabs)[number]
export type MunicipalityDetailSearchParams = DetailTabSearchParams

/**
 * B178 — the virtual Salvador city has no operational data (no dossiê,
 * lideranças or atualizações per city), so its tab set is the subset with a
 * data owner for the city: overview (rollup + entradas), elections and
 * demands. Subset of the same enum, so tab hrefs reuse the helpers below.
 */
export const cityMunicipalityDetailTabs: readonly MunicipalityDetailTab[] = [
  'overview',
  'elections',
  'demands',
]

const helpers = createDetailTabHelpers<MunicipalityDetailTab>({
  tabs: municipalityDetailTabs,
  defaultTab: 'overview',
  tabQueryKeys: {
    overview: [],
    dossie: [],
    elections: ['compare'],
    leaderships: ['leadershipQ', 'leadershipPage'],
    updates: ['updatePage', 'newUpdate'],
    demands: ['demandStatus'],
  },
  basePath: (municipalitySlug) => `/campanha/municipios/${municipalitySlug}`,
  forcedTab: (searchParams) =>
    (Array.isArray(searchParams.newUpdate) ? searchParams.newUpdate[0] : searchParams.newUpdate) ===
    '1'
      ? 'updates'
      : null,
})

export const resolveMunicipalityDetailTab = helpers.resolveTab
export const buildMunicipalityDetailTabHref = helpers.buildTabHref
