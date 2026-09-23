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
  // OPS87 — deliberate: the permission-profile family moved to the
  // browserless HTTP mode (same coverage, new spec name).
  'campaignPermissionProfileHttp',
  'campaignDemandVisibility',
  'campaignAiTranscribe',
  'campaignAgendaFeed',
  'campaignNewsletter',
  // C167 — deliberate: the cut public page/route gates are the only e2e
  // covering the new URL contract, and a migration always classifies the PR
  // as high-risk (curated only).
  'campaignSpeechCut',
  // C191-runtime — deliberate: the real-Chromium PNG smoke is the only run
  // exercising the export dimensions/size guard; the e2e manifest maps only
  // `src/**`, so without the curated entry a scripts/ diff would never wake it.
  'campaignChartPng',
  // S19 — deliberate: the share-link OG/redirect contract is new and the
  // migration makes every PR of this delivery high-risk (curated only).
  'frontendShareLink',
  // S21 — deliberate: the jingles page/player/download contract is new and the
  // migration makes every PR of this delivery high-risk (curated only).
  'frontendJingles',
  // S27 — deliberate: the Central catalogue/piece page, the public media route
  // and the vote share sheet are new contracts over the C211 collection
  // (curated only).
  'frontendConteudos',
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
    // S19/S29 — the share-link surface: the `[type]` branch serves the OG card,
    // the instant handoff and the announcement page (`.ics` included), and the
    // pure module/collection/cached read own the slug, mode, destination pool,
    // event window and publish contract.
    prefixes: [
      'src/app/(frontend)/[type]',
      'src/lib/shareLink',
      'src/lib/calendarEvent.ts',
      'src/utilities/shareLinkReads.ts',
      // S27-FOLLOWUP-DRY — the single owner of the public OG image fallback
      // (delegated by the share-link resolver and the pages below), so a diff
      // there must wake every spec that pins an og:image.
      'src/utilities/ogImageReads.ts',
      // The tag/revalidation vocabulary owner for the shareLinks listing.
      'src/utilities/documents.ts',
      'src/collections/ShareLink.ts',
      'src/components/ShareLinkRedirect.tsx',
      'src/components/shareLink',
      'src/app/(frontend)/api/share-link',
    ],
    specs: ['frontendShareLink'],
  },
  {
    // S29 — the campaign-site header extracted from `/jingles` is shared by the
    // announcement page; a diff there must wake both public specs.
    prefixes: ['src/components/CampaignPageHeader.tsx'],
    specs: ['frontendShareLink', 'frontendJingles'],
  },
  {
    // S29 — the iCal primitives extracted from the agenda feed also render the
    // announcement `.ics`; both surfaces must run.
    prefixes: ['src/lib/ical.ts'],
    specs: ['campaignAgendaFeed', 'frontendShareLink'],
  },
  {
    // S4/S29 — the share-message contract behind the home cards and the
    // announcement share menu.
    prefixes: ['src/lib/contentShare.ts'],
    specs: ['frontend', 'frontendShareLink'],
  },
  {
    // S29 — the announcement page and its spec derive the Bahia event label
    // here (the spec imports the formatter), so a diff must wake it.
    prefixes: ['src/lib/campaignTime.ts'],
    specs: ['frontendShareLink'],
  },
  {
    // S21 — the public jingles page: ordered published cards, the lazy
    // in-page player (one at a time), the slug-based download name and the
    // fail-closed publish contract of the collection.
    // S25 — the same spec owns the home sound section, now with the own radio
    // player (`lib/radio` holds the stream/share contract).
    prefixes: [
      'src/app/(frontend)/jingles',
      'src/lib/jingle',
      'src/lib/radio',
      'src/utilities/jingleReads.ts',
      // S27-FOLLOWUP-DRY — the owner of the page's og:image fallback.
      'src/utilities/ogImageReads.ts',
      // The tag/revalidation vocabulary owner for the jingles listing.
      'src/utilities/documents.ts',
      'src/collections/Jingle.ts',
      'src/components/jingles',
    ],
    // S29 — `hasPublishedJingles` also decides the footer of the announcement
    // page, so the share-link spec wakes on the same owners.
    specs: ['frontendJingles', 'frontendShareLink'],
  },
  {
    // S27 — the public Central de Conteúdos: the facet/term catalogue, the
    // on-demand play, the private-media public route, the vote share sheet and
    // the kill-switch contract over the C211 listing tag.
    prefixes: [
      'src/app/(frontend)/conteudos',
      'src/components/conteudos',
      'src/lib/contentPieceCatalog',
      'src/lib/contentPieceShare',
      'src/utilities/content/contentPieceReads.ts',
      // S27-FOLLOWUP-DRY — the owner of the page's og:image fallback.
      'src/utilities/ogImageReads.ts',
      // S28 — the theme-mode loader of the same public surface.
      'src/utilities/content/contentPieceThemeSearch.ts',
      // The tag/revalidation vocabulary owner for the content pieces listing.
      'src/utilities/documents.ts',
      'src/collections/ContentPiece.ts',
      'src/collections/ContentMedia.ts',
      // The private-media response rules the public route reuses.
      'src/lib/privateMedia',
    ],
    specs: ['frontendConteudos'],
  },
  {
    // S21 — the campaign footer owns the conditional "Jingles" discovery link
    // (it renders on the home, the cards page, `/jingles` and the S29
    // announcement page).
    // S27 — and the conditional "Conteúdos" link.
    prefixes: ['src/components/CampaignFooter.tsx'],
    specs: ['frontend', 'frontendJingles', 'frontendConteudos', 'frontendShareLink'],
  },
  {
    // S13/S30 — the personalized-cards studio lives in shared cards components
    // and pure card* modules; the state-deputy catalog (S30) feeds the picker
    // and its committed art paths, so a diff there must wake the same spec (the
    // home section is already covered by the src/app/(frontend) prefix).
    prefixes: ['src/components/cards', 'src/lib/card', 'src/lib/stateDeputyCatalog.ts'],
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
      // C165 — the activity schema/access/collection moved the município to
      // optional and added the Google link; those diffs must wake the
      // activity e2e family (the generic `src/lib/schemas` entry alone only
      // wakes the public-site/newsletter specs).
      'src/collections/Activity.ts',
      'src/lib/schemas/activity',
      'src/utilities/access/activities.ts',
    ],
    // C148 — the activity components host the agenda's three modals: the
    // create/edit overlay (campaignActivity), the Google sync dialog and the
    // iCal feed dialog. A change there must wake all three surfaces.
    specs: ['campaignActivity', 'campaignAgendaGoogleSync', 'campaignAgendaFeed'],
  },
  {
    // C149 — the Google Calendar OAuth connection surface. The engine/client
    // utilities live top-level (not under `src/utilities/activity`), and the
    // callback route sits OUTSIDE `(app)` — without this entry a diff to them
    // would only wake the home smoke, leaving the mirror spec unrun.
    // C150 — the one-click link builder and the campaign actions (picker +
    // choose) join the same domain entry.
    // C165 — the pure mapping/reverse-edit modules joined the engine surface.
    prefixes: [
      'src/utilities/googleCalendarSync.ts',
      'src/utilities/googleCalendarSyncHooks.ts',
      'src/utilities/googleCalendarClient.ts',
      'src/utilities/googleCalendarOAuth.ts',
      'src/lib/googleCalendarOAuth.ts',
      'src/lib/googleCalendarLink.ts',
      'src/lib/googleCalendarEventMapping.ts',
      'src/lib/googleCalendarReverseEdit.ts',
      'src/components/campaign/activity/AgendaGoogleSyncChrome',
      'src/components/campaign/activity/GoogleCalendarSyncDialog',
      'src/components/campaign/activity/GoogleCalendarPickerDialog',
      'src/app/(campaign)/campanha/actions/googleCalendarSync.ts',
      'src/app/(campaign)/campanha/agenda/google-oauth',
    ],
    specs: ['campaignAgendaGoogleSync'],
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
      'src/lib/campaignPageChrome.ts',
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
    // C159 — the opening-question catalog is pinned by the staff/leader chip
    // spec and by the communicator assertions in the acervo spec.
    prefixes: ['src/lib/sollinhaOpeningQuestions'],
    specs: ['campaignAiChatOpeningChips', 'campaignSpeechAcervo'],
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
    specs: ['campaignPermissionProfileHttp', 'campaignDemandVisibility'],
  },
  {
    // C199 — the recordings' timestamped ASR uses the same provider owner; the
    // acervo spec exercises the recordings surface the job feeds.
    // S28 — the same owner now generalizes the expansion for the public
    // Central, so a diff there must wake the public spec too.
    prefixes: ['src/utilities/ai'],
    specs: ['campaignAiTranscribe', 'campaignSpeechAcervo', 'frontendConteudos'],
  },
  {
    // Zod input schemas surface in the browser through form flows; the
    // public-site and newsletter specs exercise those flows end to end. C167
    // adds the cut schemas, whose HTTP contract is the cut spec; C168's library
    // mutations live in the same `speech` actions file; C194 adds the reel
    // schemas and its kill-switch action.
    prefixes: [
      'src/lib/schemas',
      'src/app/(campaign)/campanha/actions/speech.ts',
      'src/app/(campaign)/campanha/actions/reels.ts',
    ],
    specs: ['frontend', 'campaignNewsletter', 'campaignSpeechCut', 'campaignReel'],
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
    // C154 — the communication vertical: the acervo search/filters/detail and
    // the `communicationCatalog` role gate. `src/lib/speech*` carries the pure
    // search/highlight modules the RSC list renders with. C167 adds the cut
    // routes/player/dialog and the public cut page below. C194 adds the reel
    // library (list/detail/downloads/kill switch) to the same vertical. C211
    // adds the internal Central de Conteúdos (batch upload, link, cataloguing,
    // publication kill switch).
    prefixes: [
      `${CAMPAIGN_APP}/comunicacao`,
      'src/components/campaign/speech',
      'src/components/campaign/reels',
      // C199 — the uploaded recordings source and its private media owner.
      'src/components/campaign/recording',
      // C211 — the Central de Conteúdos surfaces.
      'src/components/campaign/content',
      'src/utilities/speech',
      'src/utilities/reels',
      // C199 — the shared private-media owner and the ffmpeg runner.
      'src/utilities/recordings',
      // C211 — the content piece pipeline.
      'src/utilities/content',
      'src/utilities/privateMedia',
      'src/utilities/media',
      'src/lib/speech',
      'src/lib/reel',
      'src/lib/recording',
      'src/lib/contentPiece',
      'src/lib/privateMedia',
      // The role predicates drive the vertical gate and the assistant surfaces.
      'src/lib/campaignRoles',
    ],
    specs: ['campaignSpeechAcervo', 'campaignSpeechCut', 'campaignReel'],
  },
  {
    // C167 — the unlisted public page of a cut: 200 with the stored file and
    // 404 for unpublished/unknown ids are the HTTP contract this spec owns.
    // The root share kit is rendered by both the cut card and that page; C168
    // extracted its copy button, which those same surfaces render.
    prefixes: [
      'src/app/(frontend)/corte',
      'src/components/SpeechCutShareActions.tsx',
      'src/components/CopyLinkButton.tsx',
      // S27-FOLLOWUP-DRY — the owner of the page's og:image fallback.
      'src/utilities/ogImageReads.ts',
    ],
    specs: ['campaignSpeechCut'],
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
