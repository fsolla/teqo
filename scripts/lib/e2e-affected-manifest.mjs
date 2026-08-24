/**
 * e2e manifest (OPS5): source path prefix → Playwright specs exercising it.
 * e2e specs never import app code, so this curated table is the only source
 * of truth. Granularity is the DOMAIN prefix on purpose — finer grains rot.
 * Spec names exist as tests/e2e/<name>.e2e.spec.ts (pinned by unit test).
 * Prefixes are repo-relative POSIX paths; matching is startsWith.
 *
 * OPS86 additions: `E2E_CURATED_SPECS` (the never-zero e2e set for high-risk
 * PR diffs) and `E2E_RISK_PREFIXES` (surfaces whose blast radius is the whole
 * product — RBAC, form schemas, push, AI). Both are pinned by unit invariants
 * (`e2eAffectedManifest.unit.spec.ts`): the curated set is frozen and every
 * risk prefix must stay covered by a manifest entry, so a diff in those areas
 * can never select zero e2e in silence.
 */
const CAMPAIGN_APP = 'src/app/(campaign)/campanha/(app)'

/**
 * Curated e2e cross-section for high-risk diffs (OPS86). High-risk used to
 * mean zero e2e on the PR (OPS72); this set is the smallest stable coverage of
 * the risk surfaces — RBAC/permission profiles, demand visibility, AI
 * transcription, agenda feed, newsletter capture. Frozen by design: growing
 * it requires editing the invariant pin on purpose.
 */
export const E2E_CURATED_SPECS = [
  'campaignPermissionProfile',
  'campaignDemandVisibility',
  'campaignAiTranscribe',
  'campaignAgendaFeed',
  'campaignNewsletter',
]

/**
 * Risk-area source prefixes (OPS86). A diff touching them must never select
 * zero e2e: the entries below map each prefix to specs, and the classifier
 * fails closed (mode `unmapped-risk`) if a matching file has no entry — the
 * net for manifest drift. Deliberately NOT "all of src/" (the intention's
 * "map everything" rabbit hole).
 */
export const E2E_RISK_PREFIXES = [
  'src/utilities/access',
  'src/utilities/campaignAccess.ts',
  'src/lib/schemas',
  'src/utilities/campaignPushClient.ts',
  'src/utilities/ai',
]

/**
 * Generic e2e smoke for unmapped non-risk src/ files (OPS86 fallback): the
 * home spec renders the campaign shell (login + home) with console-error
 * fail-fast. Lives here (not in the core) so the manifest entries below can
 * reference the same constant without a cycle.
 */
export const E2E_SMOKE_FALLBACK_SPEC = 'campaignHomeActions'

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
      // OPS35+ — the network-column rungs live in this file; a rung regression
      // must wake the CSS-visibility browser pin, not only the municipios specs.
      'src/components/campaign/municipality/TerritoryListColumns',
    ],
    specs: ['campaignTerritoriesHttp', 'campaignTerritoriesColumns'],
  },
  {
    prefixes: [`${CAMPAIGN_APP}/conceitos`],
    // OPS87 — server slice migrated to the browserless HTTP mode; the browser
    // spec keeps the tooltip/popover interactions.
    specs: ['campaignConceptsHttp', 'campaignConcepts'],
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
  // Sollinha AI surfaces (B162+): the shell prefix above wakes the shell
  // smoke, but the chat domain needs its own specs — the session/panel
  // behavior lives in these files (OPS22 surfaced the gap).
  {
    prefixes: [
      'src/components/campaign/shell/ai',
      'src/lib/sollinhaChatSession',
      'src/lib/ai/markdownLinks',
      `${CAMPAIGN_APP}/api/ai-chat`,
    ],
    specs: [
      'campaignSollinhaContext',
      'campaignAiChatResize',
      'campaignAiLinks',
      'campaignAiChatOpeningChips',
      'campaignSollinhaWidth',
    ],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/pessoas`,
      'src/components/campaign/people',
      'src/utilities/people',
      'src/utilities/campaignSavedFilterStore',
    ],
    // OPS87 — server slice migrated to the browserless HTTP mode; the browser
    // spec keeps the omnibox/combobox interactions and the dialog writes.
    specs: ['campaignPeopleHttp', 'campaignPeople'],
  },
  {
    prefixes: [
      `${CAMPAIGN_APP}/contatos`,
      'src/components/campaign/contacts',
      'src/utilities/contacts',
    ],
    specs: ['campaignContacts'],
  },
  // OPS86 — risk surfaces. RBAC/visibility specs were orphaned (only ran in
  // `full`); these entries map the whole access surface plus form schemas,
  // push and AI transcription. Each prefix is in `E2E_RISK_PREFIXES` and the
  // invariant pins require the pair to stay in sync.
  {
    prefixes: ['src/utilities/access', 'src/utilities/campaignAccess.ts'],
    specs: ['campaignPermissionProfile', 'campaignDemandVisibility'],
  },
  {
    prefixes: ['src/utilities/ai'],
    specs: ['campaignAiTranscribe'],
  },
  {
    // Zod input schemas surface in the browser through form flows; the
    // public-site and newsletter specs exercise those flows end to end.
    prefixes: ['src/lib/schemas'],
    specs: ['frontend', 'campaignNewsletter'],
  },
  {
    // Web Push client — the opt-in toast mounts on the campaign shell, so a
    // push diff wakes the home smoke (console-error fail-fast covers it).
    prefixes: ['src/utilities/campaignPushClient.ts'],
    specs: [E2E_SMOKE_FALLBACK_SPEC],
  },
  {
    prefixes: ['src/app/(campaign)/campanha/agenda/ical', 'src/utilities/calendarFeed'],
    specs: ['campaignAgendaFeed'],
  },
  // Domains without a dedicated e2e family still wake campaign home smoke so
  // the affected classifier cannot return mode=none on an unmapped domain dir.
  {
    prefixes: [
      // OPS87 — C142 advisor permission profiles: the write-control gating
      // lives in the advisor/access domain plus the FAB mount decision
      // (`CampaignQuickActionsHost/Fab` in the shell), exercised on the write
      // surfaces of these routes (FAB, "Nova demanda", create buttons).
      'src/lib/campaignAdvisorProfile',
      'src/lib/campaignQuickActionMount',
      'src/lib/campaignQuickActionRegistry',
      'src/components/campaign/shell',
      'src/utilities/advisor',
      'src/utilities/advisorData',
      `${CAMPAIGN_APP}/atividades`,
      `${CAMPAIGN_APP}/apoiadores`,
      `${CAMPAIGN_APP}/demandas`,
      `${CAMPAIGN_APP}/municipios`,
    ],
    specs: ['campaignPermissionProfileHttp'],
  },
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
      `${CAMPAIGN_APP}/meus-contatos`,
      `${CAMPAIGN_APP}/demandas`,
      `${CAMPAIGN_APP}/dobradinhas`,
      `${CAMPAIGN_APP}/organizacoes`,
      `${CAMPAIGN_APP}/perfil`,
      `${CAMPAIGN_APP}/quadro`,
    ],
    specs: [E2E_SMOKE_FALLBACK_SPEC],
  },
]
