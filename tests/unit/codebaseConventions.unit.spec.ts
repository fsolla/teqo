import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  legacyCamelCaseFilenameIgnores,
  legacyComponentFilenameIgnores,
  legacyComponentSyntaxIgnores,
  legacyFrameworkExportIgnores,
} from '../../eslint-legacy-ignores.mjs'

// Programmatic guards for conventions that used to be enforced only by prose
// (codebase-map.mdc / docs/ARCHITECTURE.md) and drifted during Pass 2.

const repoRoot = process.cwd()

const walkSourceFiles = (root: string, extensions: readonly string[]): string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => resolve(entry.parentPath, entry.name))

const repoPath = (absolute: string) => relative(repoRoot, absolute)

describe('server-only boundary in src/utilities', () => {
  // Files that value-import Payload run server code; if they ever land in a
  // client bundle the failure must be a build error, not a runtime surprise.
  // W2 marked 21 loaders by hand — this pins the rule for every new module.
  // Deliberate exceptions go here, each with a justification:
  const allowlist = new Set<string>([])

  const isTypeOnlyClause = (clause: string): boolean => {
    if (/^type\b/.test(clause.trim())) return true
    const inner = clause.trim().match(/^\{([\s\S]*)\}$/)?.[1]
    if (inner === undefined) return false
    return inner
      .split(',')
      .map((specifier) => specifier.trim())
      .filter(Boolean)
      .every((specifier) => specifier.startsWith('type '))
  }

  it('marks every Payload/Next-coupled utilities module with import server-only', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/utilities'), ['.ts', '.tsx'])) {
      const source = readFileSync(file, 'utf8')
      // Side-effect imports (`import 'x'`) never match: the clause group
      // cannot contain quotes, so it cannot swallow a bare specifier.
      // P3-K widened the module set: value-imports of next/cache, next/server
      // and next/headers are equally server-bound (municipalityRevalidation and
      // campaignJsonMutationRoute were invisible to the Payload-only sweep).
      const importsServerValues = [
        ...source.matchAll(
          /^import\s+([^'"]+?)\s+from\s+['"](payload|@payload-config|next\/cache|next\/server|next\/headers)['"]/gm,
        ),
      ].some(([, clause]) => !isTypeOnlyClause(clause!))

      if (!importsServerValues) continue
      if (/^import 'server-only'/m.test(source)) continue
      if (allowlist.has(repoPath(file))) continue
      offenders.push(repoPath(file))
    }

    expect(offenders, "add `import 'server-only'` (or a justified allowlist entry)").toEqual([])
  })
})

describe('banned campaign terminology', () => {
  // Every rename of an operational concept leaves prose behind: the 2026-07-23
  // remodel ("Praça"/"Núcleo" → "Município") needed a manual W4f sweep that
  // still missed 4 consent drafts, and C13 ("Plano de Ação" → "Atividade")
  // touched 62 files. Each retired term gets a row here so it cannot come back.
  // Migrations are frozen history and stay out of scope; allowlisted files
  // carry legitimate data or frozen SQL, not live copy.
  const bannedTerms = [
    {
      id: 'Praça/Núcleo',
      // Accent-tolerant (P3-K): "praca"/"nucleo" unaccented used to slip past.
      pattern: /pra[çc]|n[úu]cleo/i,
      remedy: 'use "Município" (or allowlist genuine data)',
      allowlist: [
        'src/lib/cities.ts', // real locality names (e.g. "Núcleo Bandeirante" — DF)
        // Curated projection-sheet column aliases are genuine input data.
        'src/lib/projectionSheetParse.ts',
        // Fixture entry deliberately exercises legacy visits written pre-rename.
        'tests/unit/recentVisits.unit.spec.ts',
      ],
    },
    {
      id: 'Plano de Ação',
      // Accent-tolerant (agents routinely type "plano de acao") and space-tolerant,
      // so English prose ("action plan") cannot slip past the identifier forms.
      pattern: /action[\s_-]?plan|planos? de a[çc][aã]o|\/campanha\/planos/i,
      remedy: 'use "Atividade" / activity (or allowlist frozen history)',
      allowlist: [],
    },
  ] as const

  const searchRoots = ['src', 'tests', 'scripts'] as const

  it.each(bannedTerms)('keeps $id out of src, tests and scripts', (term) => {
    // This spec quotes the banned literals itself.
    const allowlist = new Set<string>([...term.allowlist, repoPath(import.meta.filename)])
    const offenders: string[] = []

    for (const root of searchRoots) {
      for (const file of walkSourceFiles(resolve(repoRoot, root), ['.ts', '.tsx', '.mjs'])) {
        const path = repoPath(file)
        if (path.startsWith('src/migrations/')) continue
        if (allowlist.has(path)) continue

        const lines = readFileSync(file, 'utf8').split('\n')
        for (const [index, line] of lines.entries()) {
          if (term.pattern.test(line)) offenders.push(`${path}:${index + 1}`)
        }
      }
    }

    expect(offenders, term.remedy).toEqual([])
  })
})

describe('eslint legacy ignore lists', () => {
  // ESLint never validates ignore paths, so a file move silently orphans its
  // exemption (campaign-logo.tsx broke this way during Pass 2 W2).
  const unescapeGlob = (pattern: string) => pattern.replaceAll('\\[', '[').replaceAll('\\]', ']')

  it.each([
    ['legacyComponentFilenameIgnores', legacyComponentFilenameIgnores],
    ['legacyFrameworkExportIgnores', legacyFrameworkExportIgnores],
    ['legacyComponentSyntaxIgnores', legacyComponentSyntaxIgnores],
    ['legacyCamelCaseFilenameIgnores', legacyCamelCaseFilenameIgnores],
  ])('every %s entry still exists on disk', (_name, entries) => {
    const missing = entries.filter((entry) => !existsSync(resolve(repoRoot, unescapeGlob(entry))))
    expect(missing, 'file moved or deleted — update eslint-legacy-ignores.mjs').toEqual([])
  })
})

describe('campaign formActions convention', () => {
  // Any file under `(campaign)` that calls `mapCampaignFormActionError` implements
  // the hand-rolled form-action ladder and must go through the shared wrappers
  // (`runCampaignFormAction` / `runCampaignRedirectFormAction`) so error mapping
  // cannot drift per route (Pass 2 W4d / C8 F4b / OPS14). Filename is not the
  // signal — presence of the mapper is. A file that truly cannot use the wrappers
  // gets an allowlist entry documenting why:
  const allowlist = new Map<string, string>([
    // Custom unique-violation → fieldErrors + async duplicate-title fallback
    // that links to the existing activity — policy the wrappers don't grow for.
    [
      'src/app/(campaign)/campanha/(app)/atividades/formActions.ts',
      'unique-violation fieldErrors + async duplicate-title fallback',
    ],
    // Flattens field errors into message-only states for inline detail controls.
    [
      'src/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions.ts',
      'message-only flatten for inline detail controls',
    ],
    // Login: LockedAuth branch, redirect outside try, NEXT_REDIRECT rethrow.
    [
      'src/app/(campaign)/campanha/actions/auth.ts',
      'bespoke login flow — redirect and LockedAuth outside the shared ladder',
    ],
    // Password reset/change: anti-enumeration swallow, bespoke field errors,
    // NEXT_REDIRECT rethrow — policies the wrappers don't absorb.
    [
      'src/app/(campaign)/campanha/actions/password.ts',
      'anti-enumeration + bespoke password field errors outside the shared ladder',
    ],
  ])

  it('routes every hand-rolled mapCampaignFormActionError ladder through a shared wrapper', () => {
    const offenders = walkSourceFiles(resolve(repoRoot, 'src/app/(campaign)'), ['.ts'])
      .filter((file) => !/\.spec\.ts$/.test(file))
      .map(repoPath)
      .filter((path) => !allowlist.has(path))
      .filter((path) => {
        const source = readFileSync(resolve(repoRoot, path), 'utf8')
        if (!/\bmapCampaignFormActionError\s*\(/.test(source)) return false
        // Require a real call site — a comment naming the wrappers must not pass.
        return !/\brunCampaign(Redirect)?FormAction\s*\(/.test(source)
      })

    expect(offenders, 'wrap with runCampaignFormAction/runCampaignRedirectFormAction').toEqual([])
  })
})

describe('campaign JSON mutation route convention', () => {
  // The cells' quick edits POST to cookie-authenticated route handlers, so each
  // one needs the same-origin check. Written by hand it is a line a new route
  // forgets, and forgetting it fails OPEN — hence the wrapper (B32+ F2), and
  // hence this sweep, which is what stops the sixth route from opting out.
  //
  // It sweeps all of `src/app` and not just `(campaign)`: a cookie-authenticated
  // endpoint written under `api/` would be exactly as exposed and exactly as
  // invisible, so the exceptions are declared here with their reason instead of
  // being implied by a folder.
  const allowlist = new Map<string, string>([
    ['src/app/(payload)/api/[...slug]/route.ts', "re-export of Payload's own handler and auth"],
    ['src/app/(payload)/api/graphql/route.ts', "re-export of Payload's own handler and auth"],
    [
      'src/app/(frontend)/api/revalidate/route.ts',
      'server-to-server: authenticated by a secret header, deliberately callable cross-origin',
    ],
    [
      'src/app/(campaign)/campanha/api/ai-chat/route.ts',
      'streaming AI endpoint (ReadableStream, not JSON) — cookie-authenticated via campaign-token, origin-checked by cookie path',
    ],
  ])

  it('builds every POST route under src/app with campaignJsonMutationRoute', () => {
    const offenders = walkSourceFiles(resolve(repoRoot, 'src/app'), ['.ts'])
      .filter((file) => basename(file) === 'route.ts')
      .map(repoPath)
      .filter((path) => !allowlist.has(path))
      .filter((path) => {
        const source = readFileSync(resolve(repoRoot, path), 'utf8')
        // GET-only handlers (manifest, service worker) have no cookie-authed
        // mutation to guard — matched on the export and not the bare word, so a
        // GET route whose comment says "POST" is not a false offender. On the
        // positive side the binding is what is matched, not a mention of the
        // wrapper, which stops a file from pairing one wrapped handler with a
        // second hand-rolled one.
        if (!/export (const|async function) POST\b/.test(source)) return false
        return !/export const POST = campaignJsonMutationRoute\(/.test(source)
      })

    expect(offenders, 'build the handler with campaignJsonMutationRoute').toEqual([])
  })
})

describe('campaign refusal messages come from shared constants', () => {
  // `mapCampaignFormActionError` matches a thrown message against the route's
  // `safeMessages` by EXACT string, so a message spelled as a literal at both
  // ends is one reword away from silently collapsing a real refusal into the
  // generic error (B32+/B37; Pass 3 P3-A — four such collapses were live,
  // one user-reachable). Both ends must reference the shared `*_MESSAGE` /
  // `*_SAFE_MESSAGES` constants in `src/lib/schemas/*` (or the owning
  // utilities module). Internal English ops invariants that no route
  // safelists are allowlisted here:
  const allowlistedThrowLiterals = new Set<string>(['Engagement level write was dropped.'])

  const campaignAppFiles = () =>
    walkSourceFiles(resolve(repoRoot, 'src/app/(campaign)'), ['.ts']).filter(
      (file) => !/\.spec\.ts$/.test(file),
    )

  it('keeps string literals out of safeMessages arrays', () => {
    const offenders: string[] = []

    for (const file of campaignAppFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/safeMessages\s*:\s*\[/g)) {
        const start = (match.index ?? 0) + match[0].length
        const body = source.slice(start, source.indexOf(']', start))
        if (/['"`]/.test(body)) offenders.push(repoPath(file))
      }
    }

    expect(offenders, 'reference shared *_MESSAGE / *_SAFE_MESSAGES constants').toEqual([])
  })

  it('keeps string literals out of throw new Error in campaign app files', () => {
    const offenders: string[] = []

    for (const file of campaignAppFiles()) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/throw new Error\(\s*(['"`])([^]*?)\1/g)) {
        if (!allowlistedThrowLiterals.has(match[2]!)) {
          offenders.push(`${repoPath(file)}: "${match[2]}"`)
        }
      }
    }

    expect(
      offenders,
      'throw via a shared *_MESSAGE constant (or allowlist an internal English invariant)',
    ).toEqual([])
  })
})

describe('form-action feedback comes from the primitive', () => {
  // P3-G: 10 of 15 hand-spelled `{state.message && state.status !== 'success'}`
  // blocks were mute for assistive tech. `CampaignFormActionMessage` owns the
  // aria-live region, so the raw spelling is banned — adoption IS the
  // prevention. Declared exceptions, each with its reason:
  const allowlist = new Set<string>([
    // The primitive itself.
    'src/components/campaign/shared/CampaignFormActionMessage.tsx',
    // Toast-only channel (no inline JSX): success AND error both go through
    // sonner — a legitimate different feedback idiom, not a mute Alert.
    'src/components/campaign/advisor/AdvisorPasswordResetButton.tsx',
  ])

  it('keeps the raw feedback condition out of campaign components', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/components/campaign'), ['.tsx'])) {
      const path = repoPath(file)
      if (allowlist.has(path)) continue
      const source = readFileSync(file, 'utf8')
      if (/state\.message\s*(&&|\|\|)\s*state\.(status|fieldErrors)/.test(source)) {
        offenders.push(path)
      }
    }

    expect(offenders, 'render feedback via CampaignFormActionMessage').toEqual([])
  })
})

describe('CLI skeleton comes from scripts/lib/cli.mjs', () => {
  // P3-H: `die`, `sha256`, the download→cache prologue and the dotenv preamble
  // were re-spelled in 5–7 scripts each — the newest copied the OLD shape.
  // These belong to `scripts/lib/cli.mjs` alone; a new script re-spelling any
  // of them breaks the build here.
  const bannedPatterns: ReadonlyArray<[id: string, pattern: RegExp, remedy: string]> = [
    ['die spelling', /const die = \(message\) =>/, 'use dieWithLabel from scripts/lib/cli.mjs'],
    ['sha256 spelling', /const sha256 = \(buffer\) =>/, 'use sha256Hex from scripts/lib/cli.mjs'],
    [
      'dotenv preamble',
      /loadEnv\(\{ path: '\.env\.local' \}\)/,
      'use loadCliEnv from scripts/lib/cli.mjs',
    ],
    [
      'local host list',
      /const LOCAL_HOSTS = new Set/,
      'import LOCAL_HOSTS from scripts/lib/cli.mjs',
    ],
  ]

  const allowlist = new Set<string>(['scripts/lib/cli.mjs'])

  it.each(bannedPatterns)('keeps the %s out of scripts/', (_id, pattern, remedy) => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'scripts'), ['.mjs'])) {
      const path = repoPath(file)
      if (allowlist.has(path)) continue
      if (pattern.test(readFileSync(file, 'utf8'))) offenders.push(path)
    }

    expect(offenders, remedy).toEqual([])
  })
})

describe('form-action feedback goes through CampaignFormActionMessage', () => {
  // P3-G: the raw `{state.message && state.status …}` JSX was spelled in 15
  // places and 10 were mute for assistive tech (no aria-live). The primitive
  // owns the live region, so adoption = prevention; a new raw spelling breaks
  // the build here. Distinct forms are allowlisted with their reason:
  const allowlist = new Set<string>([
    // The primitive itself.
    'src/components/campaign/shared/CampaignFormActionMessage.tsx',
    // toast.error channel — the control has no inline alert at all (the
    // destructive feedback rides the toast, mirroring the success one).
    'src/components/campaign/advisor/AdvisorPasswordResetButton.tsx',
  ])

  it('keeps the raw feedback JSX out of campaign components', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/components/campaign'), ['.tsx'])) {
      const path = repoPath(file)
      if (allowlist.has(path)) continue
      const source = readFileSync(file, 'utf8')
      if (/state\.message\s*&&\s*state\.status/.test(source)) offenders.push(path)
    }

    expect(offenders, 'render via CampaignFormActionMessage').toEqual([])
  })
})

describe('src/utilities top-level is pinned', () => {
  // P3-J: domain subfolders (municipality/supporter/territory/leadership/
  // visit/webauthn) executed the Pass 2 D1 trigger. This allowlist IS the
  // trigger encoded: a NEW top-level module fails the build until registered
  // here with a reason — at 3 new modules of one domain in a month, the
  // domain earns a subfolder instead.
  const pinnedTopLevel = new Set<string>([
    'activityDetailPageData.ts',
    'activityDetailTabUi.ts',
    'activityFormData.ts',
    'activityInlineErrors.ts',
    'activityOmnibox.ts',
    'activityLeadershipOptions.ts',
    'activityPageData.ts',
    'activityRelationOptions.ts',
    'activityResponsibleSearch.ts',
    'activityUi.ts',
    'activityViewModels.ts',
    'advisorData.ts',
    'calendarFeed.ts',
    'campaignAccess.ts',
    'campaignActionContext.ts',
    'campaignAuditFields.ts',
    'campaignAuth.ts',
    'campaignBiometricsPrompt.ts',
    'campaignColumnVisibilityCookie.ts',
    'campaignConsent.ts',
    'campaignDashboardData.ts',
    'campaignVoteSummarySnapshot.ts',
    'campaignDemandData.ts',
    'campaignEntityActions.ts',
    'campaignFormActionError.ts',
    'campaignFormFields.ts',
    'campaignGeolocation.ts',
    'campaignGoals.ts',
    'campaignInvite.ts',
    'campaignInviteCreation.ts',
    'campaignInviteOrigin.ts',
    'campaignInvitePageData.ts',
    'campaignInviteRedemption.ts',
    'campaignInviteRepository.ts',
    'campaignJsonMutationRoute.ts',
    'campaignListUrl.ts',
    'campaignPageActor.ts',
    'campaignPasswordReset.ts',
    'campaignPwa.ts',
    'campaignPwaClient.ts',
    'campaignRelationOptions.ts',
    'campaignUserProfile.ts',
    'consentContentHash.ts',
    'contactPhoneInvariant.ts',
    'dashboardPriorityMunicipalities.ts',
    'detailTabUi.ts',
    'documentReads.ts',
    'documents.ts',
    'drizzleBulk.ts',
    'electionCache.ts',
    'electionCandidateOptions.ts',
    'electionResultsImport.ts',
    'entityNotFound.ts',
    'extractFirstImageFromLexical.ts',
    'formatRelativeAge.ts',
    'globalReads.ts',
    'globals.ts',
    'hookFilledData.ts',
    'leaderContactsPageData.ts',
    'loadNamesByIds.ts',
    'onda0Provision.ts',
    'organizationData.ts',
    'payloadTransaction.ts',
    'postgresTransactionLocks.ts',
    'posts.ts',
    'recentVisits.ts',
    'revalidateRequest.ts',
    'sameOriginRequest.ts',
    'seo.ts',
    'signatureExport.ts',
    'stateDeputyData.ts',
    'stateDeputyListFilters.ts',
    'stateDeputyListUrl.ts',
    'stateDeputyOmnibox.ts',
    'voteEstimateScenarioFields.ts',
    'votePledgeData.ts',
    'votePledgeViews.ts',
  ])

  it('fails the build on an unregistered top-level module', () => {
    const actual = readdirSync(resolve(repoRoot, 'src/utilities'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)

    const unregistered = actual.filter((name) => !pinnedTopLevel.has(name))
    const stale = [...pinnedTopLevel].filter((name) => !actual.includes(name))

    expect(unregistered, 'register the module here with a reason, or subfolder the domain').toEqual(
      [],
    )
    expect(stale, 'pin is stale — file moved or deleted, update it').toEqual([])
  })
})

describe('campaign route-page actor comes from requireCampaignPageActor', () => {
  // P3-I: the staff page prologue was ~110 hand-spelled lines across 30 pages
  // with a real divergence (`return null` ×5 — a blank screen for a missing
  // session). A page that re-spells `getCampaignUser()` breaks the build here;
  // genuinely bespoke prologues are allowlisted with their reason:
  const allowlist = new Set<string>([])

  it('keeps getCampaignUser() out of (app) route pages', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/app/(campaign)/campanha/(app)'), [
      '.tsx',
    ])) {
      const path = repoPath(file)
      if (basename(file) !== 'page.tsx' || allowlist.has(path)) continue
      if (/getCampaignUser\(\)/.test(readFileSync(file, 'utf8'))) offenders.push(path)
    }

    expect(offenders, 'use requireCampaignPageActor from @/utilities/campaignPageActor').toEqual([])
  })
})

describe('system-stamped actor field comes from campaignAuditFields', () => {
  // P3-I: the `createdBy` relationship + readOnly + canSet* shape drifted
  // organically across 7 collections. The factory is data-driven; a
  // hand-spelled actor field breaks the build here. Genuinely distinct actor
  // fields are allowlisted with their reason:
  const allowlist = new Set<string>([
    // `decidedBy`/`decidedAt` are decision-audit fields with semantics the
    // stamping factory does not cover (set by the workflow hook, not create).
    'src/collections/CampaignDemand.ts',
  ])

  it('keeps hand-spelled actor fields out of collections', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src/collections'), ['.ts'])) {
      const path = repoPath(file)
      if (allowlist.has(path)) continue
      const source = readFileSync(file, 'utf8')
      // The hand-spelled shape pairs the actor name with its relationship;
      // factory options name the field but never spell `relationTo` here.
      if (
        /name: '(createdBy|decidedBy|declaredBy)',[\s\S]{0,200}relationTo: 'campaignUser'/.test(
          source,
        )
      ) {
        offenders.push(path)
      }
    }

    expect(offenders, 'use systemStampedActorField from @/utilities/campaignAuditFields').toEqual(
      [],
    )
  })
})

describe('advisor scope fragment comes from access/shared.ts', () => {
  // P3-D: `{ municipality(s): { in: ids ?? [] } }` was re-spelled in 6 access
  // domain modules. The named policy is `advisorMunicipalityScopeWhere`; a new
  // collection that rewrites the fragment breaks the build here. Query builders
  // outside access/ that filter their own domain by municipality ids are
  // genuinely distinct forms — allowlisted file by file:
  const allowlist = new Set<string>([
    'src/app/(campaign)/campanha/actions/leadership.ts',
    'src/collections/Supporter.ts',
    'src/utilities/campaignDashboardData.ts',
    'src/utilities/leadership/leadershipData.ts',
    'src/utilities/leadership/leadershipListUrl.ts',
    'src/utilities/municipality/municipalityTriggers.ts',
    // B155 — the municipality list surface reads `leadership.municipalities`
    // by reverse batch; same distinct form as `leadershipData.ts` above.
    'src/utilities/municipality/municipalityViewModels.ts',
    'src/utilities/visit/visitPlannerData.ts',
    'src/utilities/votePledgeData.ts',
  ])

  it('keeps the scope fragment out of re-spellings', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src'), ['.ts', '.tsx'])) {
      const path = repoPath(file)
      if (path === 'src/utilities/access/shared.ts' || allowlist.has(path)) continue
      const source = readFileSync(file, 'utf8')
      if (/municipalit(?:y|ies):\s*\{\s*in:/.test(source)) offenders.push(path)
    }

    expect(offenders, 'use advisorMunicipalityScopeWhere (or allowlist a distinct form)').toEqual(
      [],
    )
  })
})

describe('admin bypasses carry a justification comment', () => {
  // P3-E: "Local API com `user` sempre com `overrideAccess: false`; bypass
  // admin só com comentário justificando" was social — 89 of 127 bypasses had
  // none. Documented means a comment containing "bypass" within 10 lines above
  // the occurrence, or a module-policy comment in the file's first 40 lines.
  // This is a RATCHET: counts may only shrink. A new undocumented bypass fails
  // the build; documenting an old one means lowering its pin.
  const pinnedUndocumented = new Map<string, number>([
    ['src/app/(campaign)/campanha/actions/advisor.ts', 2],
    ['src/app/(campaign)/campanha/actions/leaderSupporter.ts', 1],
    ['src/app/(campaign)/campanha/actions/leadership.ts', 3],
    ['src/app/(campaign)/campanha/actions/municipality.ts', 1],
    ['src/app/(campaign)/campanha/actions/password.ts', 2],
    ['src/app/(campaign)/campanha/actions/profile.ts', 4],
    ['src/app/(campaign)/campanha/actions/stateDeputy.ts', 0],
    ['src/app/(campaign)/campanha/actions/supporter.ts', 9],
    ['src/app/(campaign)/campanha/actions/supporterImport.ts', 2],
    ['src/app/(campaign)/campanha/actions/votePledge.ts', 1],
    ['src/utilities/activityDetailPageData.ts', 1],
    ['src/utilities/advisorData.ts', 2],
    ['src/utilities/campaignInviteCreation.ts', 1],
    ['src/utilities/campaignInvitePageData.ts', 1],
    ['src/utilities/campaignInviteRedemption.ts', 13],
    ['src/utilities/campaignInviteRepository.ts', 2],
    ['src/utilities/electionCandidateOptions.ts', 1],
    ['src/utilities/territory/loadTerritoryOverview.ts', 1],
    ['src/utilities/municipality/municipalityCandidateComparison.ts', 2],
    ['src/utilities/municipality/municipalityElectoralBaseline.ts', 8],
    ['src/utilities/onda0Provision.ts', 4],
    ['src/utilities/stateDeputyData.ts', 0],
    ['src/utilities/visit/visitPlannerData.ts', 1],
    ['src/utilities/access/campaignUsers.ts', 2],
    ['src/utilities/access/contacts.ts', 2],
    ['src/utilities/access/leaderships.ts', 1],
    ['src/utilities/access/municipalities.ts', 3],
    ['src/utilities/access/shared.ts', 2],
    ['src/utilities/access/webauthnCredentials.ts', 1],
    ['src/collections/Activity.ts', 0],
    ['src/collections/CampaignDemand.ts', 1],
    ['src/collections/CampaignUser.ts', 4],
    ['src/collections/CampaignWebAuthnCredential.ts', 1],
    ['src/collections/Media.ts', 1],
    ['src/collections/Municipality.ts', 1],
    ['src/collections/MunicipalityUpdate.ts', 3],
    ['src/collections/Supporter.ts', 1],
    ['src/collections/SupporterImportBatch.ts', 1],
    ['src/collections/Users.ts', 1],
    ['src/collections/VotePledge.ts', 1],
  ])

  const countUndocumented = (path: string): number => {
    const lines = readFileSync(resolve(repoRoot, path), 'utf8').split('\n')
    const header = lines.slice(0, 40).join('\n').toLowerCase()
    let count = 0
    for (const [index, line] of lines.entries()) {
      if (!line.includes('overrideAccess: true')) continue
      const context = lines
        .slice(Math.max(0, index - 10), index)
        .join('\n')
        .toLowerCase()
      if (!context.includes('bypass') && !header.includes('bypass')) count += 1
    }
    return count
  }

  it('never grows the undocumented-bypass count of any file', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src'), ['.ts', '.tsx'])) {
      const path = repoPath(file)
      if (path.startsWith('src/migrations/') || path.endsWith('.spec.ts')) continue
      const pinned = pinnedUndocumented.get(path) ?? 0
      const actual = countUndocumented(path)
      if (actual > pinned) {
        offenders.push(`${path}: ${actual} undocumented (pin: ${pinned})`)
      }
      if (actual < pinned) {
        offenders.push(`${path}: improved to ${actual} — lower the pin from ${pinned}`)
      }
    }

    expect(offenders, 'justify with a "bypass" comment (or lower the pin)').toEqual([])
  })
})

describe('e2e name locators are anchored', () => {
  // An unanchored template regex on a catalog name collides with prefix-shared
  // names (Conde/Condeúba — 23/435 measured in the catalog, Pass 3 P3-C).
  // Anchored regexes (`^…` / `…$`) and plain strings with `exact: true` are fine.
  it('keeps unanchored template regexes out of tests/e2e', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'tests/e2e'), ['.ts'])) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/new RegExp\(`([^`]*)`\)/g)) {
        const pattern = match[1]!
        if (!pattern.startsWith('^') && !pattern.endsWith('$')) {
          offenders.push(`${repoPath(file)}: \`${match[1]}\``)
        }
      }
    }

    expect(offenders, 'anchor with ^ or use the plain string with exact: true').toEqual([])
  })
})

describe('public site metadata global access', () => {
  // An empty `metadata` global (fresh DB / poisoned unstable_cache) used to
  // crash `next build` via raw field access. Every `getCachedGlobal('metadata')`
  // consumer must also call `resolveSiteMetadata` in the same file.
  it('routes every metadata global consumer through resolveSiteMetadata', () => {
    const offenders: string[] = []

    for (const file of walkSourceFiles(resolve(repoRoot, 'src'), ['.ts', '.tsx'])) {
      const path = repoPath(file)
      if (path.startsWith('src/migrations/')) continue

      const source = readFileSync(file, 'utf8')
      if (!/getCachedGlobal\(\s*['"]metadata['"]\s*\)/.test(source)) continue
      if (!/\bresolveSiteMetadata\b/.test(source)) {
        offenders.push(path)
      }
    }

    expect(offenders, 'import and call resolveSiteMetadata from @/utilities/seo').toEqual([])
  })
})
