# Improve Code Quality Plan

Two passes so far: **Pass 1** (2026-07-23/24, phases 0–6 below, all done) and **Pass 2** (started 2026-07-25, see [Pass 2](#pass-2--engineering-consolidation-2026-07-25)).

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
| 2026-07-23 | 1     | CI on the GitHub mirror (`.github/workflows/ci.yml`)                                                | Pushes go to Codeberg + GitHub; GitHub Actions runs on the mirror with a Postgres 17 service                                                     |
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

| WS  | Content                                                                                                                                 | Plan file                                                            | Status  | Date |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- | ---- |
| W0  | Safety net: pin list URL parsers + list loaders (unit + int smokes); TESTING/TECH-DEBT truth-up                                         | [pinagem-superficies-lista.md](plans/pinagem-superficies-lista.md)   | done | 2026-07-25 |
| W1  | Generalized campaign list system (D1 core + municipality; D2 migrate entity triplet/demandas/apoiadores/assessores + delete superseded) | [sistema-listas-campanha.md](plans/sistema-listas-campanha.md)       | done | 2026-07-25 |
| W2  | Architecture decision (DDD/clean-arch/SDP evaluation → conventions + boundary fixes) + staged `components/campaign` subfolders          | [decisao-arquitetura-dominios.md](plans/decisao-arquitetura-dominios.md) | done | 2026-07-25 |
| W3  | `docs/ARCHITECTURE.md` + `.cursor/rules/codebase-map.mdc`                                                                               | [mapa-mental-arquitetura.md](plans/mapa-mental-arquitetura.md)       | done | 2026-07-25 |
| W4a | `electionInsights.ts` gut/split: extract `electionFormat`, keep voteTrend, delete dead clusters (before E10)                            | [split-election-insights.md](plans/split-election-insights.md)       | done | 2026-07-25 |
| W4b | knip unused-exports warn→error: delete zero-ref exports, un-export in-file symbols, config, CI flip                                     | (tracker only)                                                        | done | 2026-07-25 |
| W4c | Detail-page RSC extraction (`municipios/[slug]`, `planos/[slug]`) + dedupe detail-tab helper twins                                      | (tracker only)                                                        | done |       2026-07-25 |
| W4d | formActions finish: `runCampaignFormAction` (stay-on-page) + migrate 9 hand-rolled ladders (closes C8 F4)                               | (tracker only)                                                        | done |       2026-07-25 |
| W4e | Single-source types: scenario triple, strategy VM, trend enum, duplicated constants/helpers, `DynamicFind` doc                          | (tracker only)                                                        | done |       2026-07-25 |
| W4f | "Praça"→"Município" user-visible copy sweep (~55 visible hits + admin labels; consent texts stay for the legal batch)                   | (tracker only)                                                        | done |       2026-07-25 |
| W5  | Documentation close-out: AGENTS.md refresh, ledger/TESTING reconcile, plan-status patches, roadmap fold-in, product-doc drift findings  | (tracker only)                                                        | done |       2026-07-25 |
| D3  | `consent: 2` hardcode → Onda 0 provisional-key pattern (data migration + fail-closed switch; **migration SQL reviewed before landing**) | (tracker only)                                                        | done |       2026-07-25 |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Pass 2 Decisions (signed off 2026-07-25)

| ID  | Decision                                                                                                                                                                                                       | Rationale                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **No `src/domains/` reorg, no ports-and-adapters.** Conventions + mechanical boundary fixes + staged within-layer subfolders for `components/campaign/`; `utilities/` subfoldering deferred with trigger        | Payload collections ARE the data model; a big-bang move freezes the repo mid-window and risks the importmap. Full evaluation in [decisao-arquitetura-dominios.md](plans/decisao-arquitetura-dominios.md) |
| D2  | **Delete** the ~52 consumer-less `electionInsights` exports (+ their tests) rather than quarantining them                                                                                                        | git history + plans carry the formulas; E10 replaces the 35/20/10 threshold approach with relative classification — keeping dead math invites accidental reuse                                 |
| D3  | `consent: 2` hardcode folded into the Onda 0 provisional-key pattern in-pass, as an isolated delivery with the migration SQL explicitly reviewed by the user before landing                                     | Same fail-closed pattern as `lideranca-autopreenchimento`; leaving the hardcode makes the legal batch harder to verify                                                                        |
| D4  | users-roles migration stays ledgered/deferred                                                                                                                                                                    | Schema migration; only blocks widening `/admin`, which isn't scheduled                                                                                                                        |
| D5  | W1 scope boundary: planos stays cards (adopts toolbar/URL state only), `TerritoryOverviewTable` stays a documented client-sort exception, LeaderContacts/candidate-comparison/import-preview stay out            | Anti-classitis: the system earns its migrations; small static tables don't pay for the abstraction                                                                                            |
| D6  | Praça sweep = user-visible copy + admin labels; provisional Onda 0 consent texts untouched (legal batch)                                                                                                        | Consent text versions are counsel-owned; code shouldn't edit them cosmetically                                                                                                                |

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
