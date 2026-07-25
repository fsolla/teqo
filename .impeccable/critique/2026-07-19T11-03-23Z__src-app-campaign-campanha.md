---
target: /campanha
total_score: 32
p0_count: 0
p1_count: 0
p2_count: 3
p3_count: 2
timestamp: 2026-07-19T11-03-23Z
slug: src-app-campaign-campanha
---

Method: dual-agent (A: 43c7ddf0-03c4-40b6-86e4-167ed820fbc3 · B: c685e95f-8884-4bd6-9174-53d1a4613689)

# Critique: /campanha

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------ |
| 1         | Visibility of System Status     | 4         | Freshness on KPI surfaces; filter aria-busy/live region                  |
| 2         | Match System / Real World       | 4         | Núcleo vs Zona TSE stated on list; domain language solid                 |
| 3         | User Control and Freedom        | 4         | Differentiated AlertDialogs; clear filter clear/back                     |
| 4         | Consistency and Standards       | 3         | List/dashboard on CampaignPageShell; detail/forms still ad-hoc max-w     |
| 5         | Error Prevention                | 3         | Constrained selects + ZE validation; otherwise unchanged                 |
| 6         | Recognition Rather Than Recall  | 4         | URL filters; RecentlyVisited; freshness timestamps                       |
| 7         | Flexibility and Efficiency      | 2         | No saved views; triage queues still one-by-one (CSV bulk only)           |
| 8         | Aesthetic and Minimalist Design | 3         | Metric strips + one priority lift; MetricStrip still double-card surface |
| 9         | Error Recovery                  | 3         | Leadership empty has CTA; coordenador empty still prose-only             |
| 10        | Help and Documentation          | 2         | One Núcleo/ZE line; engajado / estimativa vocabulary still unexplained   |
| **Total** |                                 | **32/40** | **Good**                                                                 |

## Anti-Patterns Verdict

**LLM assessment:** Not AI slop. Field Desk intent lands: CampaignMetricStrip (explicit anti-grid), priority surface reserved for one panel, theme quarantine, semantic badges, side-tab ban verified clean in source.

**Deterministic scan (CLI):** 0 findings on `src/app/(campaign)/campanha` and `src/components/campaign` (exit 0). Regex engine is blind to DOM/heading order and Tailwind arbitrary transitions — under-covers by design.

**Visual overlays:** Injection succeeded on live dashboard (session authenticated as geral). Overlay: overused-font/single-font Inter (false positive by design); nested-cards on CardHeader (false positive); nested-cards on CampaignMetricStrip `<dl>` (real — card-in-card styling); skipped-heading h1→h3 (real); layout-transition height on Sidebar/Drawer primitives (real, systemic).

## Overall Impression

Prior P1s (filter wall, hero-metric card grids, side-tab) are closed. The surface now reads as a serious ops desk with hierarchy and progressive disclosure. Remaining drag is power-user throughput (bulk triage), first-timer jargon, and a few a11y/composition leftovers the CLI cannot see.

## What's Working

1. **CampaignMetricStrip + priority lift** — shared replacement for the banned identical KPI card grid across dashboard, núcleos, apoiadores.
2. **NucleusFilters progressive disclosure** — primary territory + search; cobertura/estimativa/prioridade behind Mais filtros with count badge.
3. **Side-tab ban + shell convergence** — no `border-l-*` accents in campaign components; list/dashboard share CampaignPageShell.

## Priority Issues

### [P2] Domain jargon still opaque beyond one sentence

**What:** engajado, estimativa confirmada vs proposta, support statuses lack tooltips/help.
**Why it matters:** Lia and first-timers translate under pressure; Help heuristic still weakest.
**Fix:** Inline ? / first-visit hint on SupportStatusBadge and estimate labels.
**Suggested command:** `/impeccable clarify`

### [P2] Dashboard queues cannot be triaged in bulk

**What:** Sem coordenador / stale updates / pending estimates are one-row links only.
**Why it matters:** Alex under time pressure on a growing queue; CSV bulk exists for import but not daily triage.
**Fix:** Multi-select + assign on the priority queue only.
**Suggested command:** `/impeccable layout`

### [P2] Dashboard heading outline skips h2

**What:** Detector + source: h1 "Visão geral" then QueueSection h3 before Indicadores h2.
**Why it matters:** Screen-reader document outline; Sam persona.
**Fix:** Promote Filas section title to h2, demote queue titles to h3; or insert sr-only/visible h2.
**Suggested command:** `/impeccable audit`

### [P3] Coordenador empty state has no CTA

**What:** Prose-only empty vs leadership empty with Ver meu perfil.
**Why it matters:** Last sibling of the old dead-end pattern.
**Fix:** Mirror EmptyContent CTA pattern.
**Suggested command:** `/impeccable onboard`

### [P3] MetricStrip double card surface + sidebar height transition

**What:** Overlay nested-cards on strip `bg-card` inside `bg-card`; Sidebar `transition-[width,height,padding]`.
**Why it matters:** Mild visual nesting / layout jank risk — not task-blocking.
**Fix:** Flatten inner metric cells to transparent; prefer transform/opacity on chrome.
**Suggested command:** `/impeccable quieter` / `/impeccable optimize`

## Persona Red Flags

**Alex (geral/coordenador):** Still one-by-one queues; no saved filter views.

**Casey (mobile field):** Touch targets OK; no ambient offline/stale cue in shell during normal use (only /campanha/offline hard fallback).

**Lia (liderança):** Empty state improved with CTA; card still leads with Sem estimativa confirmada; engajado unexplained.

## Minor Observations

- AlertTriangle on routine leadership empty is tonally alarmist for a peer first-run.
- Detail/form pages still hand-roll max-w-3xl/4xl/6xl outside CampaignPageShell.
- Icon-on-every-button reads intentional (confident-compact), not filler.

## Cognitive Load

2 checklist failures (no bulk/saved views; jargon). Primary NucleusFilters decision point ≤4 visible options. Moderate → low-moderate.

## Questions to Consider

1. Is bulk triage intentionally deferred because "onboarding is bulk, ops is retail"?
2. Should CampaignPageShell grow size variants, or stay list/dashboard-only?
3. Is coordenador empty prose-only deliberate (escalate verbally) vs leadership self-service?
4. How much inline glossary is enough before a help surface?

## Emotional Journey

Peak: estimate confirm / archive with consequence-clear dialogs. Valley: liderança card absence line; coordenador empty without next action.
