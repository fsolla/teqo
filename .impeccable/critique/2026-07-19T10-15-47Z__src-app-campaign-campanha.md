---
target: /campanha
total_score: 28
p0_count: 0
p1_count: 3
p1_count_note: filters, kpi-grid, side-tab
p2_count: 2
timestamp: 2026-07-19T10-15-47Z
slug: src-app-campaign-campanha
---

Method: dual-agent (A: 89c6189f-1341-4e15-8d45-e1aa7c6f5167 · B: 3e87667e-e21e-4a29-85b4-db65afcc49c5)

# Critique: /campanha

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------ |
| 1         | Visibility of System Status     | 3         | Pending/aria-live on filters; no freshness/"as of" on KPI aggregates     |
| 2         | Match System / Real World       | 4         | Domain language precise (Núcleo vs Zona TSE disambiguated)               |
| 3         | User Control and Freedom        | 3         | Clear filters/back; limited undo for irreversible paths                  |
| 4         | Consistency and Standards       | 3         | Strong component discipline; role dashboards diverge in max-width/chrome |
| 5         | Error Prevention                | 3         | Constrained selects + inline ZE validation                               |
| 6         | Recognition Rather Than Recall  | 4         | Filter state in URL; labels on actions                                   |
| 7         | Flexibility and Efficiency      | 2         | No saved views; queues are one-by-one, no bulk                           |
| 8         | Aesthetic and Minimalist Design | 2         | geral dashboard = even wall of same-weight Cards                         |
| 9         | Error Recovery                  | 3         | Forgot-password names fallback; leadership empty does not                |
| 10        | Help and Documentation          | 1         | Almost no glossary/tooltips for ZE / engajado / estimativa               |
| **Total** |                                 | **28/40** | **Good**                                                                 |

## Anti-Patterns Verdict

**LLM assessment:** Not classic AI slop. Theme quarantine (`data-theme='campaign'` + `bg-none`) and semantic status tokens are deliberate. The tell is the repeated **hero-metric Card grid** (dashboard / núcleos overview / apoiadores) — exactly the anti-reference named in PRODUCT.md/DESIGN.md — plus icon-per-button and copy-pasted page shells.

**Deterministic scan (CLI):** 1 finding — `side-tab` (`border-l-4 border-primary`) in `src/components/campaign/NucleusElectoralBaseline.tsx:79`. Real hit, not a false positive; absolute ban in DESIGN.md.

**Visual overlays:** Injection succeeded on the live dashboard (session redirected login → `/campanha`). Overlay flagged `overused-font` / `single-font` (Inter-by-design → false positive), `layout-transition` (unverified), and many `nested-cards` (shadcn Card/CardHeader class-name false positives). No reliable additional anti-pattern beyond the CLI `side-tab` and the LLM-noted KPI grid density.

## Overall Impression

A serious field desk with strong a11y/touch discipline and honest empty-state copy — undermined by a template dashboard of identical metric cards, an always-open 6-filter wall on núcleos, and a leadership empty state that strands the persona the product calls a peer. Biggest opportunity: make hierarchy and triage decisions for the user instead of presenting equal-weight problem scoreboards.

## What's Working

1. **Theme quarantine is real** — campaign tokens + `bg-none` kill public-site gradient kitsch.
2. **Systemic touch/a11y** — `min-h-11`, live regions on filters, proper `aria-invalid` on ZE input.
3. **Scope-honest empty/error copy** — "você só vê núcleos no seu escopo"; phone-only reset routes to coordinator.

## Priority Issues

### [P1] Filter panel decision overload

**What:** `NucleusFilters` shows 6 fields at once on desktop (TI, município, ZE, cobertura, estimativa, prioridade) plus search.
**Why it matters:** Primary triage tool under time pressure; violates clarity-under-pressure and >4 options rule.
**Fix:** Keep territory + search primary; put coverage/estimate/priority behind "Mais filtros" at all breakpoints.
**Suggested command:** `/impeccable distill` / `/impeccable layout`

### [P1] Hero-metric Card grids contradict own anti-references

**What:** General dashboard, NucleusListOverview, SupporterListOverview all use Card → description → big number grids.
**Why it matters:** PRODUCT/DESIGN ban identical card grids / hero-metric templates; this is the strongest "template AI" tell.
**Fix:** Compact secondary metrics into a stat row; reserve Card + priority lift for 1–2 decisive numbers; rank action queues.
**Suggested command:** `/impeccable quieter` / `/impeccable layout`

### [P1] Side-tab accent on baseline row (detector)

**What:** `border-l-4 border-primary` on highlighted candidate in NucleusElectoralBaseline.
**Why it matters:** Absolute ban (side-stripe >1px); deterministic AI-tell.
**Fix:** Full border, background tint only, or leading mark — no thick left stripe.
**Suggested command:** `/impeccable quieter`

### [P2] Liderança empty state is a dead end

**What:** "Nenhum núcleo" / "vínculo engajado" + warning icon, no CTA.
**Why it matters:** Peer persona stranded; jargon without next step.
**Fix:** Mirror forgot-password — name who to contact (coordenador / WhatsApp).
**Suggested command:** `/impeccable clarify` / `/impeccable onboard`

### [P2] No freshness signal on aggregates

**What:** KPIs/overviews never show when data was computed.
**Why it matters:** Field decisions need trust in recency.
**Fix:** Relative "atualizado há…" near overview headers.
**Suggested command:** `/impeccable harden`

### [P3] Split brand chrome (mobile red bar vs desktop stone rail)

**What:** Mobile top bar is solid Mandate Red; desktop sidebar is quiet rail.
**Why it matters:** Breaks Signal Red Rule for Casey/Lia switching devices unless intentional "field mode."
**Fix:** Document as field-mode signal or quiet the mobile chrome.
**Suggested command:** `/impeccable quieter`

## Persona Red Flags

**Alex (geral/coordenador):** No saved filter views; queues are one-by-one with equal weight — must supply triage the UI should do.

**Casey (mobile field):** Opened accordion still stacks 6 full-width fields; no ambient stale/offline cue in shell; primary CTAs scroll away.

**Lia (liderança phone-first):** Reset and unlinked-núcleo paths both require a more-privileged human; dashboard opens on "Sem estimativa confirmada" as the boldest line; jargon (engajado, ZE) unexplained.

## Minor Observations

- Leadership empty uses `AlertTriangleIcon` in wrong Empty slot vs `EmptyMedia`.
- Three dashboard max-widths (`2xl` / `5xl` / `4xl`) without clear intent.
- Dual relative-time helpers.
- `Badge secondary` overloaded (empty count vs category).
- Icon-on-every-button may be decorative filler vs confident-compact.

## Cognitive Load

2–3 checklist failures: 6-filter wall; geral dashboard lacks progressive disclosure; no single primary "do this now." Moderate load — address soon.

## Questions to Consider

1. Why do dashboards converge on the banned hero-metric grid three times — exception or unreviewed?
2. Is Lia's human-gated recovery acceptable honesty, or quiet demotion?
3. Should the UI pick which fire to put out first among the three equal queues?
4. Is the mobile red bar deliberate field-mode, or Signal Red Rule drift?

## Emotional Journey

Peak: confirmed estimate / successful update. End/valley: leadership dashboard often closes on absence ("Sem estimativa confirmada"); unlinked empty is a hard stop; problem-scoreboard queues create ambient anxiety without priority.
