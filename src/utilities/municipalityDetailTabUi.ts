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

const helpers = createDetailTabHelpers<MunicipalityDetailTab>({
  tabs: municipalityDetailTabs,
  defaultTab: 'overview',
  tabQueryKeys: {
    overview: [],
    dossie: [],
    elections: ['compare'],
    leaderships: ['leadershipQ', 'leadershipPage'],
    updates: ['updateKind', 'updatePage', 'newUpdate'],
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
