/**
 * e2e manifest (OPS5): source path prefix → Playwright specs exercising it.
 * e2e specs never import app code, so this curated table is the only source
 * of truth. Granularity is the DOMAIN prefix on purpose — finer grains rot.
 * Spec names exist as tests/e2e/<name>.e2e.spec.ts (pinned by unit test).
 * Prefixes are repo-relative POSIX paths; matching is startsWith.
 */
const CAMPAIGN_APP = 'src/app/(campaign)/campanha/(app)'

export const E2E_AFFECTED_MANIFEST = [
  {
    prefixes: ['src/app/(payload)'],
    specs: ['admin'],
  },
  {
    prefixes: ['src/app/(frontend)'],
    specs: ['frontend'],
  },
  {
    prefixes: ['src/app/(campaign)/campanha/login', 'src/utilities/campaignAuth'],
    specs: ['campaignAuth'],
  },
  {
    prefixes: ['src/app/(campaign)/campanha/webauthn', 'src/utilities/webauthn'],
    specs: ['campaignWebAuthn'],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/municipios`,
      `${CAMPAIGN_APP}/municipio`,
      'src/components/campaign/municipality',
      'src/components/campaign/map',
      'src/components/campaign/shared/CampaignListOmnibox',
      'src/lib/campaignListOmnibox',
      'src/lib/campaignMunicipality',
      'src/utilities/municipality',
    ],
    specs: [
      'campaignMunicipalities',
      'campaignZoneMap',
      'campaignNearestMunicipality',
      'campaignSavedFilters',
      'campaignColumnPicker',
    ],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/agenda`,
      `${CAMPAIGN_APP}/atividades`,
      'src/components/campaign/activity',
      'src/utilities/activity',
      'src/utilities/activityOmnibox',
      'src/lib/activityQuickActions',
    ],
    specs: ['campaignActivity'],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/liderancas`,
      'src/components/campaign/leadership',
      'src/utilities/leadership',
    ],
    specs: ['campaignLeaderships'],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/territorios`,
      'src/components/campaign/tour',
      'src/utilities/territory',
    ],
    specs: ['campaignTerritories'],
  },
  {
    prefixes: [`${CAMPAIGN_APP}/conceitos`],
    specs: ['campaignConcepts'],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/page.tsx`,
      `${CAMPAIGN_APP}/home-search`,
      'src/components/campaign/dashboard',
      'src/utilities/homeSearch',
      'src/utilities/campaignDashboardData',
      'src/lib/campaignHomeSearchHits',
      'src/lib/homeSearchShare',
      'src/lib/homeSearchExcludeCurrentEntity',
      'src/lib/homeSearchNearestMunicipalityMerge',
      'src/lib/homeSearchSuggest',
      'src/lib/homeSearchUi',
    ],
    // Home search suggest/exclude is exercised on municipality detail (B109)
    // as well as the home action suite.
    specs: ['campaignHomeActions', 'campaignMunicipalities'],
  },
  {
    prefixes: [
      'src/components/campaign/shell',
      'src/components/ui/Drawer',
      `${CAMPAIGN_APP}/layout.tsx`,
      'src/utilities/campaignPwa',
      'src/lib/campaignQuickAction',
      'src/lib/campaignReferenceQuickActions',
      'src/lib/campaignPaths.ts',
    ],
    specs: ['campaign-pwa', 'campaignWizardChrome', 'campaignBottomNav', 'campaignMunicipalities'],
  },
  // Domains without a dedicated e2e family still wake campaign home smoke so
  // the affected classifier cannot return mode=none on an unmapped domain dir.
  {
    prefixes: [
      'src/components/campaign/advisor',
      'src/components/campaign/demand',
      'src/components/campaign/invite',
      'src/components/campaign/organization',
      'src/components/campaign/stateDeputy',
      'src/components/campaign/suggestion',
      'src/components/campaign/supporter',
      'src/components/campaign/votePledge',
      'src/components/campaign/auth',
      'src/lib/searchOnlyListOmnibox',
      'src/utilities/advisor',
      'src/utilities/advisorData',
      'src/utilities/campaignDemandData',
      'src/utilities/demand',
      'src/utilities/organization',
      'src/utilities/organizationData',
      'src/utilities/stateDeputyOmnibox',
      'src/utilities/supporter/supporterOmnibox',
      `${CAMPAIGN_APP}/acoes`,
      'src/components/campaign/shared/WizardMunicipality',
      'src/components/campaign/shared/useCampaignListFilterNavigation',
      'src/components/campaign/shared/useNearestMunicipalitySlug',
      'src/lib/wizardMunicipalitySuggestMerge',
      `${CAMPAIGN_APP}/apoiadores`,
      `${CAMPAIGN_APP}/assessores`,
      `${CAMPAIGN_APP}/atualizacoes`,
      `${CAMPAIGN_APP}/contatos`,
      `${CAMPAIGN_APP}/demandas`,
      `${CAMPAIGN_APP}/dobradinhas`,
      `${CAMPAIGN_APP}/organizacoes`,
      `${CAMPAIGN_APP}/perfil`,
      `${CAMPAIGN_APP}/quadro`,
    ],
    specs: ['campaignHomeActions'],
  },
]
