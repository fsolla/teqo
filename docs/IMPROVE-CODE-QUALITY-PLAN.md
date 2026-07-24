# Improve Code Quality Plan

## Context

- **Started:** 2026-07-23
- **Trigger:** full-codebase engineering-standards review (five parallel audits: structure/dead code, RBAC, client boundary/state, loading UX, caching) of a rapidly built ("vibe coded") codebase.
- **Scope:** whole repo; production is live (Neon Postgres with real citizens' PII), so security ordered first.
- **Method:** `improve-code-quality` journey, compressed into the seven delivery phases below (mapping to the skill's phases noted per row). The audits replaced a separate intake; the existing test suite (238 unit + 345 int + 5 e2e specs) is the safety net.
- **Companion docs:** [TECH-DEBT.md](TECH-DEBT.md) (ledger), [TESTING.md](TESTING.md) (safety-net map), [roadmap.md](roadmap.md) (canonical product/engineering backlog — larger debts become roadmap items per the `capture-review-debts` convention).

## Phase Status

| Phase | Content                                                                                                                      | Skill phases                           | Status      | Date       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- | ---------- |
| 0     | Security lockdown: collection access defaults, leader route gates, broken leader-supporter create, candidate alignment       | — (P0 pre-work)                        | done        | 2026-07-23 |
| 1     | Tooling gate: knip + dead code, CI, tsconfig, zero lint warnings, `as never` ban, docs artifacts                             | 1 (net) + 2 (readability) + 6 (habits) | done        | 2026-07-23 |
| 2     | Caching: React `cache()` dedup, committed election-aggregate artifact, `unstable_cache`, select/depth trims                  | 8 (sizing)                             | done        | 2026-07-23 |
| 3     | Loading feedback: task-toggle revalidation bug, map compare transition, result-region pending, Suspense streaming            | — (UX correctness)                     | done        | 2026-07-23 |
| 4     | Client boundary/state: map hover isolation, provider narrowing, composition splits (bundle slimming deferred with rationale) | 4 (deep modules, UI)                   | done        | 2026-07-23 |
| 5     | Structure: split campaignAccess + supporter actions, dedupe clones, utilities organization, finish rename                    | 3 (refactoring) + 4 (deep modules)     | in-progress | 2026-07-23 |
| 6     | Documentation: engineering-standards rule, AGENTS.md drift fixes, debt registration                                          | 6 (habits)                             | in-progress | 2026-07-23 |

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

- [x] Phase 0 shipped (commit `fe0fb1c`)
- [ ] Phase 1: finish tests `as never` conversion; full verify (lint/typecheck/test/build); commit
- [ ] Phase 2 — caching
- [ ] Phase 3 — loading feedback
- [ ] Phase 4 — client boundary
- [ ] Phase 5 — structure
- [ ] Phase 6 — documentation; register leftovers in TECH-DEBT.md Debt Ledger
