# Improve Code Quality Plan

Four passes so far: **Pass 1** (2026-07-23/24, phases 0–6 below, all done), **Pass 2** (2026-07-25, see [Pass 2](#pass-2--engineering-consolidation-2026-07-25)), **Pass 3** (2026-07-28, audit + plan, see [Pass 3](#pass-3--engineering-audit--consolidation-2026-07-28)) and **Pass 4** (2026-07-31, audit + P0/P1 remediation + miss guardrails in-session, see [Pass 4](#pass-4--engineering-audit--remediation--guardrails-2026-07-31)).

## Context

- **Started:** 2026-07-23
- **Trigger:** full-codebase engineering-standards review (five parallel audits: structure/dead code, RBAC, client boundary/state, loading UX, caching) of a rapidly built ("vibe coded") codebase.
- **Scope:** whole repo; production is live (Neon Postgres with real citizens' PII), so security ordered first.
- **Method:** `improve-code-quality` journey, compressed into the seven delivery phases below (mapping to the skill's phases noted per row). The audits replaced a separate intake; the existing test suite (238 unit + 345 int + 5 e2e specs) is the safety net.
- **Companion docs:** [TECH-DEBT.md](TECH-DEBT.md) (ledger), [TESTING.md](TESTING.md) (safety-net map), [roadmap.md](roadmap.md) (canonical product/engineering backlog — larger debts become roadmap items per the `capture-review-debts` convention).

## Phase Status

| Phase | Content                                                                                                                      | Skill phases                           | Status | Date       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ | ---------- |
| 0     | Security lockdown: collection access defaults, leader route gates, broken leader-supporter create, candidate alignment       | — (P0 pre-work)                        | done   | 2026-07-23 |
| 1     | Tooling gate: knip + dead code, CI, tsconfig, zero lint warnings, `as never` ban, docs artifacts                             | 1 (net) + 2 (readability) + 6 (habits) | done   | 2026-07-23 |
| 2     | Caching: React `cache()` dedup, committed election-aggregate artifact, `unstable_cache`, select/depth trims                  | 8 (sizing)                             | done   | 2026-07-23 |
| 3     | Loading feedback: task-toggle revalidation bug, map compare transition, result-region pending, Suspense streaming            | — (UX correctness)                     | done   | 2026-07-23 |
| 4     | Client boundary/state: map hover isolation, provider narrowing, composition splits (bundle slimming deferred with rationale) | 4 (deep modules, UI)                   | done   | 2026-07-23 |
| 5     | Structure: split campaignAccess + supporter actions, dedupe clones, utilities organization, finish rename                    | 3 (refactoring) + 4 (deep modules)     | done   | 2026-07-24 |
| 6     | Documentation: engineering-standards rule, AGENTS.md drift fixes, debt registration                                          | 6 (habits)                             | done   | 2026-07-24 |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Key Decisions

| Date       | Phase | Decision                                                                                            | Rationale                                                                                                                                        |
| ---------- | ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-23 | 0     | Collection access lockdown before anything else                                                     | Payload defaults allowed any authenticated user (incl. campaign JWTs) to CRUD `users`/`signature`/`subscription`/`consent` via `/api` — live PII |
| 2026-07-23 | 0     | Keep pinned test contracts; stale tests updated, not silently changed code                          | Two leader-phone tests encoded the pre-remodel model; code was right, tests were stale                                                           |
| 2026-07-23 | 1     | `as never` banned repo-wide (ESLint `no-restricted-syntax`)                                         | It silences all type checking; replaced by typed helpers (`hookFilledCreateData`, tests' `stub<T>`) that keep property-level checking            |
| 2026-07-23 | 1     | Lint gate is zero warnings (`--max-warnings=0`)                                                     | Warnings that never fail teach everyone to ignore the linter                                                                                     |
| 2026-07-23 | 1     | knip: files/dependencies = error; unused exports = warn (ledgered)                                  | 158 export findings are dominated by god modules Phase 5 splits; failing CI on them day one would freeze the repo                                |
| 2026-07-23 | 1     | CI on GitHub Actions (`.github/workflows/ci.yml`)                                                   | GitHub is the only home; GitHub Actions runs on the mirror with a Postgres 17 service                                                            |
| 2026-07-23 | 2     | Immutable TSE aggregates become a committed artifact (script-generated), not build-time computation | Vercel builds must not depend on prod DB content (TSE seeds are local-only); provenance stays explicit like `build:geometries`                   |
| 2026-07-23 | 2     | Salvador is the only zone-split municipality in the artifact                                        | 2026-07-23 remodel: Camaçari is a single municipality (ZE 170/171 aggregated)                                                                    |
| 2026-07-23 | 4     | Map-bundle slimming deferred                                                                        | gzip crushes the repeating JSON keys to ~15-25KB on the wire; instant year/scenario switching is a core analysis flow (discovery kernel)         |
| 2026-07-23 | 4     | Props→state effect mirrors accepted as correct                                                      | guarded-equality sync is the deliberate server-echo/local-draft reconciliation (A10 pattern), not derived state                                  |
| 2026-07-23 | 5     | Entity twins deduped by POLICY, not by generic data plumbing                                        | `runStaffEntityMutation` keeps callers' concrete Payload types; a generic slug-union factory could not be type-proven                            |

## Next Actions

- [x] Phase 0 shipped (`fe0fb1c`)
- [x] Phase 1 — tooling gate (`1f73626`)
- [x] Phase 2 — caching (`a9b111b`)
- [x] Phase 3 — loading feedback (`3323275`)
- [x] Phase 4 — client boundary (`c4ec15f`)
- [x] Phase 5 — structure (`524ae57`)
- [x] Phase 6 — documentation (`deca5c0`)
- [x] E2E-driven fixes: leader home Forbidden, leader contact visibility, duplicate nav keys, RSC function-prop contracts, fixed e2e dist dir (`cb6c152`)
- [ ] Remaining leftovers live in [TECH-DEBT.md](TECH-DEBT.md) Debt Ledger (drive knip `exports` warn→error, consent-window lease redesign, e2e local-latency flake, users roles migration)

---

# Pass 2 — Engineering Consolidation (2026-07-25)

## Context

- **Started:** 2026-07-25 (plan approved same day)
- **Trigger:** everything shipped since Pass 1 (B15/B16/B19, E4R, E8/E9/E16/E18, A11, C12…) one-shotted per-feature infrastructure again. Six parallel audits (duplication, module boundaries, type honesty/dead code, safety net, docs drift, roadmap alignment) produced the evidence.
- **Goal:** (1) generalized shared infrastructure where logic was per-feature (the campaign list/table system above all); (2) a deliberate, documented architecture; (3) an explicit mental model (`docs/ARCHITECTURE.md` + agent-facing map rule) that lets a human or agent orient in minutes.
- **Method:** same `improve-code-quality` journey; each workstream is an independent delivery (full gate per delivery: `tsc --noEmit`, `pnpm lint` zero warnings, `pnpm exec knip`, `pnpm test`, `pnpm build`, Aikido scan), structure-only commits never mixed with behavior. Sequenced around the electoral calendar (window 1 → 05/08, window 2 → 16/08; nothing near the ~20/09 freeze).
- **Audit headlines:** 12 `ui/Table` surfaces with a half-built shared spine; `src/lib/electionInsights.ts` 941 lines / 71 exports / **2 used in production**; `municipalityUi.ts` 765 lines / 59 exports (new god module); 21 loaders missing `server-only`, 9 `lib/`→`utilities/` inversions, 1 type cycle, client sidebar importing the access barrel; knip unused exports 158→164; safety net 41 unit / 46 int / 7 e2e with supporter/actionPlan/entity-list parsers+loaders unpinned; "Praça" copy ~96 hits in 53 files vs the ledger's ~15; AGENTS.md structure/route drift.

## Workstream Status

| WS  | Content                                                                                                                                 | Plan file                                                                | Status | Date       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ---------- |
| W0  | Safety net: pin list URL parsers + list loaders (unit + int smokes); TESTING/TECH-DEBT truth-up                                         | [pinagem-superficies-lista.md](plans/pinagem-superficies-lista.md)       | done   | 2026-07-25 |
| W1  | Generalized campaign list system (D1 core + municipality; D2 migrate entity triplet/demandas/apoiadores/assessores + delete superseded) | [sistema-listas-campanha.md](plans/sistema-listas-campanha.md)           | done   | 2026-07-25 |
| W2  | Architecture decision (DDD/clean-arch/SDP evaluation → conventions + boundary fixes) + staged `components/campaign` subfolders          | [decisao-arquitetura-dominios.md](plans/decisao-arquitetura-dominios.md) | done   | 2026-07-25 |
| W3  | `docs/ARCHITECTURE.md` + `.cursor/rules/codebase-map.mdc`                                                                               | [mapa-mental-arquitetura.md](plans/mapa-mental-arquitetura.md)           | done   | 2026-07-25 |
| W4a | `electionInsights.ts` gut/split: extract `electionFormat`, keep voteTrend, delete dead clusters (before E10)                            | [split-election-insights.md](plans/split-election-insights.md)           | done   | 2026-07-25 |
| W4b | knip unused-exports warn→error: delete zero-ref exports, un-export in-file symbols, config, CI flip                                     | (tracker only)                                                           | done   | 2026-07-25 |
| W4c | Detail-page RSC extraction (`municipios/[slug]`, `planos/[slug]`) + dedupe detail-tab helper twins                                      | (tracker only)                                                           | done   | 2026-07-25 |
| W4d | formActions finish: `runCampaignFormAction` (stay-on-page) + migrate 9 hand-rolled ladders (closes C8 F4)                               | (tracker only)                                                           | done   | 2026-07-25 |
| W4e | Single-source types: scenario triple, strategy VM, trend enum, duplicated constants/helpers, `DynamicFind` doc                          | (tracker only)                                                           | done   | 2026-07-25 |
| W4f | "Praça"→"Município" user-visible copy sweep (~55 visible hits + admin labels; consent texts stay for the legal batch)                   | (tracker only)                                                           | done   | 2026-07-25 |
| W5  | Documentation close-out: AGENTS.md refresh, ledger/TESTING reconcile, plan-status patches, roadmap fold-in, product-doc drift findings  | (tracker only)                                                           | done   | 2026-07-25 |
| D3  | `consent: 2` hardcode → Onda 0 provisional-key pattern (data migration + fail-closed switch; **migration SQL reviewed before landing**) | (tracker only)                                                           | done   | 2026-07-25 |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Pass 2 Decisions (signed off 2026-07-25)

| ID  | Decision                                                                                                                                                                                                 | Rationale                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **No `src/domains/` reorg, no ports-and-adapters.** Conventions + mechanical boundary fixes + staged within-layer subfolders for `components/campaign/`; `utilities/` subfoldering deferred with trigger | Payload collections ARE the data model; a big-bang move freezes the repo mid-window and risks the importmap. Full evaluation in [decisao-arquitetura-dominios.md](plans/decisao-arquitetura-dominios.md) |
| D2  | **Delete** the ~52 consumer-less `electionInsights` exports (+ their tests) rather than quarantining them                                                                                                | git history + plans carry the formulas; E10 replaces the 35/20/10 threshold approach with relative classification — keeping dead math invites accidental reuse                                           |
| D3  | `consent: 2` hardcode folded into the Onda 0 provisional-key pattern in-pass, as an isolated delivery with the migration SQL explicitly reviewed by the user before landing                              | Same fail-closed pattern as `lideranca-autopreenchimento`; leaving the hardcode makes the legal batch harder to verify                                                                                   |
| D4  | users-roles migration stays ledgered/deferred                                                                                                                                                            | Schema migration; only blocks widening `/admin`, which isn't scheduled                                                                                                                                   |
| D5  | W1 scope boundary: planos stays cards (adopts toolbar/URL state only), `TerritoryOverviewTable` stays a documented client-sort exception, LeaderContacts/candidate-comparison/import-preview stay out    | Anti-classitis: the system earns its migrations; small static tables don't pay for the abstraction                                                                                                       |
| D6  | Praça sweep = user-visible copy + admin labels; provisional Onda 0 consent texts untouched (legal batch)                                                                                                 | Consent text versions are counsel-owned; code shouldn't edit them cosmetically                                                                                                                           |

## Next Actions

- [x] Materialize Pass 2 tracker section + per-workstream plans
- [x] W0 → W1-D1 → W1-D2, W4a/W4e/W4f interleaved (all 2026-07-25)
- [x] W2 → W4c/W4d → W3
- [x] W4b (last code delivery) → W5 (docs close-out)
- [x] D3 isolated delivery — **migration `20260725_170000_whatsapp_subscription_consent_key` must be SQL-reviewed by the user before pushing/deploying** (applies to prod on the Vercel build)
- [ ] Post-pass follow-ups live in [TECH-DEBT.md](TECH-DEBT.md) (utilities/ subfolder trigger, `MunicipalityHeaderFilter` generalization trigger, e2e depth, users-roles migration) and the roadmap fill-ins

## Product-doc drift findings (reported, deliberately NOT applied — product owner's call)

- **PRODUCT.md** still describes surfaces with nuclei-era wording in places (e.g. references to the pre-remodel operational unit); the design principles and job statement remain accurate.
- **DESIGN.md** component inventory misses the canonical shared components consolidated in Pass 2 (`CampaignTable` column system, `CampaignListFooter`, `CampaignListEmptyState`, `CampaignListPendingBoundary` family) — worth a section when DESIGN.md is next revised.
- **docs/CUSTOMER.md** maps field request O6 to E13, but the shipped answer was **E16** (dossiê) — the mapping note should say "atendido por E16; E13 segue como evolução".

---

# Pass 3 — Engineering Audit & Consolidation (2026-07-28)

## Context

- **Started:** 2026-07-28 (audit executed and plan signed off same day).
- **Trigger:** user-requested sweep for code smells + consolidation of similar components/hooks/functions (even when not identical — small behavior deltas accepted under the behavior-delta protocol), inspired by the engineering-standards skills catalog. The audit method is now codified as the reusable skill `.cursor/skills/engineering-audit/SKILL.md`.
- **Method:** read-only audit. Canon loaded (rules, ARCHITECTURE, TECH-DEBT, TESTING, `escala-dry-pos-*` plans, consolidation precedents, rejected-with-reason list); hotspot map (churn × size × static gates); **five parallel sweeps** (lib+scripts, utilities+access, components, app+collections+globals, tests); consolidation hunt under the anti-DRY rule (knowledge, not text); 11 open ledger rows re-verified.
- **Baseline:** green — `tsc` 0 errors, `lint` 0 warnings, `knip` 0 findings (known `payload.config.ts` load error, P3), madge 0 cycles (650 files).
- **Audit headlines (all measured):**
  - **0 P0.** Security invariants held in all five sweeps (access declarations, `overrideAccess: false`, transactions, WebAuthn B40 ×4, consent fail-closed).
  - **1 P1:** the red e2e gate is still red — every ledgered locator verified live + newly measured root cause: unanchored municipality-name regex at `campaignMunicipalities.e2e.spec.ts:263` (23/435 prefix collisions in the catalog).
  - **2 correctness P2s:** 4 `safeMessages` entries that can never match their thrown messages (1 user-reachable — advisor deciding an escalated demanda); `consentId` client-trusted in the public petition-signature flow.
  - **~1,100+ lines of measured duplication** across 9 consolidation workstreams (scripts CLI ~150, e2e users ~280, access predicates ~120, page prologues ~110, filter shells ~100, Org/SD config ~58, names-by-ids ×7+, list-URL machines ×4 domains…).
  - **Ledger hygiene:** B34+ F2 stale (resolved by B37 — close); MunicipalityHeaderFilter trigger closed (shared system shipped); e2e-thin row stale on count (15 specs/31 cases); `utilities/` subfoldering trigger **FIRED** (6 domains).
  - **11 defer+trigger** registered without new IDs (YAGNI / deep modules — the B34+/B37 pattern).
- **Plan:** [entrega-engenharia-p3.md](plans/entrega-engenharia-p3.md) (workstreams P3-A…P3-L, defer+trigger table, look-alikes rejected, execution rules).

## Workstream Status

| WS   | Content                                                                      | Plan file                                                  | Status                                                                               |
| ---- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P3-A | Refusal messages as constants + safeMessages↔throw correspondence guard      | [entrega-engenharia-p3.md](plans/entrega-engenharia-p3.md) | done 2026-07-29                                                                      |
| P3-B | Petition signature consent resolved server-side                              | (same)                                                     | done 2026-07-29                                                                      |
| P3-C | E2E gate green + e2e/int fixture alignment (P1)                              | (same)                                                     | done 2026-07-29                                                                      |
| P3-D | Access layer: named policies (advisor-scope ×7, accessible-ids engine)       | (same)                                                     | done 2026-07-29                                                                      |
| P3-E | Loaders: names-by-ids wrappers, cache-tag module, pledge fold, scope select  | (same)                                                     | done 2026-07-29                                                                      |
| P3-F | List-URL factories + filter/search shells unification                        | (same)                                                     | done 2026-07-29 (codec/multi-toggle/round-trip tail deferred w/ trigger)             |
| P3-G | Form feedback primitives (10 silent error alerts → a11y fix)                 | (same)                                                     | done 2026-07-29                                                                      |
| P3-H | `scripts/lib/cli.mjs` + single municipality-name fold (import alias bug)     | (same)                                                     | done 2026-07-29                                                                      |
| P3-I | Collections config factory + route layer (formActions finish, page prologue) | (same)                                                     | done 2026-07-29 (bespoke action ladders + advisors route schema deferred w/ trigger) |
| P3-J | `utilities/` subfoldering — D1 trigger fired (6 domains)                     | (same)                                                     | done 2026-07-29                                                                      |
| P3-K | Guard hardening + constants/type single-sourcing                             | (same)                                                     | done 2026-07-29                                                                      |
| P3-L | Ledger + docs reconcile                                                      | (same)                                                     | done 2026-07-29                                                                      |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Pass 3 Decisions (signed off 2026-07-28)

| ID  | Decision                                                                                                                                                                                                                                                                                                 | Rationale                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Waves ordered correctness (A–C) → structure (D–J) → guards/docs (K–L); one consolidation per delivery                                                                                                                                                                                                    | Correction before structure; each delivery independently gated and revertable                                                                                                                                                                |
| D2  | Behavior-delta protocol accepted                                                                                                                                                                                                                                                                         | The owner's "results may change a bit" license made safe: every delta listed per item; existing pins are the characterization net, updated deliberately — never silently                                                                     |
| D3  | 11 two-call-site consolidation candidates registered as defer+trigger, not merged                                                                                                                                                                                                                        | The repo's abstraction gate (3+ call sites or a policy worth naming); anti-classitis — merges must reduce interface count                                                                                                                    |
| D4  | Anti-DRY rule enforced: every merge names the duplicated knowledge; look-alikes serving different rules rejected                                                                                                                                                                                         | DRY is about knowledge, not text (pragmatic-programmer); the rejected list lives in the plan to prevent re-proposals                                                                                                                         |
| D5  | No route/collection/migration and no URL-contract change in this pass                                                                                                                                                                                                                                    | B18 frozen contract; P3-F preserves it by construction (round-trip through each domain's own parser)                                                                                                                                         |
| D6  | Prevention-first amendment (2026-07-28): every workstream item classifies its recurrence guard on the determinism ladder (type → ESLint → convention spec → CI analysis → behavioral pin → doc); new guards ship in the SAME delivery as the fix; existing guards' dodgeability is re-audited every pass | The audit itself found three dodgeable guards (accent-sensitive vocabulary regex, `next/*` value imports invisible to the `server-only` sweep, `*FormActions.ts` filename shape) — preventing recurrence is part of the fix, not a follow-up |

## Next Actions

- [ ] P3-A → P3-L as independent deliveries (full gate each; Aikido on edited files)
- [ ] Leftovers and new debts → ledger via `capture-review-debts`; oversized items → Issue rastreável via `plan-issue`

---

# Pass 4 — Engineering Audit + Remediation + Guardrails (2026-07-31)

## Context

- **Started:** 2026-07-31 — first **autonomous (Cursor Cloud)** execution of the `engineering-audit` skill, and the first harvest of `kind:agent-miss` (OPS2 scope: this pass also creates `docs/GUARDRAILS.md`).
- **Precheck (fail-closed):** `agent:gh-doctor` OK (GH_TOKEN, Issues read/write); agent pool **desligado** — solitary audit confirmed.
- **Delta anchor:** Pass 3 (2026-07-28). 880 files touched in 3 days of agent-paradigm work (homeSearch ×28 files, notifications/push ×7+, wizard ×12, WebAuthn ×8, 5 migrations).
- **Method:** canon loaded; hotspot map (delta + churn + static gates); **five parallel sweeps** (lib+scripts, utilities+access, components, app+collections+globals, tests) with measured findings; consolidation hunt under the anti-DRY rule; 5 miss issues harvested and investigated; 16 open ledger rows re-verified; P0/P1 + miss guardrails remediated in-session, each in its own PR with full gate.
- **Baseline:** green — `tsc` 0, `lint` 0 warnings, `knip` 0 findings (known `payload.config.ts` loader noise, ledger P3 — verified still true), madge 0 cycles (**774 files**, +124 since Pass 3).

## Audit headlines (all measured)

- **1 P0:** the four public globals (`site-settings`, `home`, `metadata`, `privacy-policy`) spelled `update: Boolean(user)` — campaign JWTs authenticate against `/api/*`, so any campaign session (leader included) could PATCH the public site. Collections were locked in Phase 0; globals were missed. **Remediated in-session** ([PR #91](https://github.com/fsolla/teqo/pull/91)).
- **1 P1:** `scripts/seed-posts.mjs` called `dieWithLabel` **without importing it** — ReferenceError on the empty-fetch abort path; P3-H half-adoption in the same pass that created the CLI guard. **Remediated in-session** ([PR #92](https://github.com/fsolla/teqo/pull/92)).
- **5 misses → 5 guardrails:** #73 deadlock class **reproduced** (7 int violations + 11 hardcoded e2e deep links) → allocator migration + 3-rule guard ([PR #93](https://github.com/fsolla/teqo/pull/93)); #52 residual per-cell Drawers on 3 chip lists → shared host ×3 + dev invariant + guard ([PR #94](https://github.com/fsolla/teqo/pull/94)); #53 one-shot probe race → readiness gate + pin; #54 measured **0 unsettled goto pairs** → calibrated guard + TESTING.md convention ([PR #95](https://github.com/fsolla/teqo/pull/95)); #83's guard (`agent:ship` + hooks, PR #89) verified alive → issue closed, no new guard.
- **Flake honesty:** `campaignLeaderships` chip spec fails **deterministically in dev** on clean stage (instrumented: no POST in 60 s; not the hydration class) — prod green 48/48. Registered, **not** retry-fixed.
- **Ledger hygiene:** rows 33/34 (safeMessages, petition consentId) verified fixed → closed; row 17 counts → 17 specs/48 cases; rows 35/40/45 updated with verified counts and trigger status (NOT fired); row 19 mitigated (unanchored literals gone + guarded); rows 10/12/14/21/23/28/31 verified still true (23 with updated path). **15 new rows** (P2/P3) with evidence.
- **12 guard dodges measured:** 3 hardened in-session (ESLint lib zone type-imports, CLI import-presence, Local API omission + dynamic-import); the rest → workstreams or registered (map in the plan).
- **Duplication for the plan:** ~500+ measured lines across P4-A…P4-E + P4-G; 12 defer+trigger entries; 6 look-alikes rejected with reason.

## Remediation deliveries (done, full gate each)

| WS        | Content                                                                                                                                       | PR                                            | Status                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| P4-P0     | Public globals lockdown ×4 + notification bell loaders actor-typed (no bypass) + int pins + `globalAccessConventions` guard                   | [#91](https://github.com/fsolla/teqo/pull/91) | open (Ready, base stage)                            |
| P4-P1     | seed-posts import fix + `scriptCliConventions` (die-import, `DAY_MS`) + ESLint lib-zone type-import ban + `localApiOverrideAccessConventions` | [#92](https://github.com/fsolla/teqo/pull/92) | open (Ready, base stage)                            |
| P4-M73    | Miss #73: allocator migration (int class-agnostic rewrite + e2e claim) + `testMunicipalityAllocatorConventions` (3 rules)                     | [#93](https://github.com/fsolla/teqo/pull/93) | open (Ready, base stage) — `Closes #73`             |
| P4-M52    | Miss #52: `CampaignListSheetProvider` ×3 lists + dev invariant + `sharedSheetHostConventions`                                                 | [#94](https://github.com/fsolla/teqo/pull/94) | open (Ready, base stage) — `Closes #52`             |
| P4-M53/54 | Misses #53+#54: `expectCampaignBiometricsReady` + unsettled-goto guard + TESTING.md convention                                                | [#95](https://github.com/fsolla/teqo/pull/95) | open (Ready, base stage) — `Closes #53, closes #54` |

## Pass 4 Decisions

| ID  | Decision                                                                          | Rationale                                                                                                                                        |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Each remediation in its own PR with the recurrence guard in the **same** delivery | Prevention-first (Pass 3 D6); guards that land later never land                                                                                  |
| D2  | Editors lose writes to the four config globals (deliberate narrowing)             | They are site config, not editorial content; `canManagePublishedContent` untouched; widening later is a named-policy decision                    |
| D3  | #54 guard calibrated to "unsettled goto pairs", not a `goto` ban                  | Measured: 58 gotos, 0 unsettled; the miss itself warned against a global ban                                                                     |
| D4  | Dev-mode chip flake registered, not retry-fixed                                   | Instrumentation showed no POST ever fires — not a race; retry masks non-race bugs; prod is the gate                                              |
| D5  | Class-agnostic int fixtures over class-pinned slugs                               | The pinned behavior (filter/sort by class) never needed reduto/marginal identity — allocation kills the deadlock class without weakening the pin |
| D6  | Aikido scan not run (MCP unavailable in this Cloud environment)                   | The per-change scan stays mandatory where the server exists; the ledger row (exit-2/SCA-unverified) is unchanged                                 |

## Next Actions

- [x] Artifacts PR = Ready + auto-merge (mesmo contrato `agent-pr-workflow`; sem exceção de merge humano); remediation PRs merge independently
- [ ] P4-A → P4-L as independent deliveries ([entrega-engenharia-p4.md](plans/entrega-engenharia-p4.md)); oversized items → Issue rastreável via `plan-issue`
- [ ] Leftovers → ledger via `capture-review-debts`
