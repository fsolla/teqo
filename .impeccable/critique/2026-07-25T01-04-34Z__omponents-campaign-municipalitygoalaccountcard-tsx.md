---
target: Conta da cadeira card (/campanha/municipios/<slug>) — MunicipalityGoalAccountCard.tsx tooltips
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-07-25T01-04-34Z
slug: omponents-campaign-municipalitygoalaccountcard-tsx
---

Method: dual-agent (A: 92b63fbf-f200-4a00-9cc5-81db3f317b57 · B: 35312920-2be2-4bac-92aa-0fbb62c2a571)

## Design Health Score

| #         | Heuristic                           | Score     | Key Issue                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1         | Visibility of System Status         | 3         | Coverage %, deficit text, and provenance ("estimativa da mesa") are all stated plainly; the 0%-coverage `Progress` bar is a near-invisible 4px hairline, understating urgency at the most common early-campaign state.                                                         |
| 2         | Match Between System and Real World | 2         | "Teto do campo," "share intracampo," "roll-off," "campo" are coined composites — confirmed by the product's own coordinator calling these "conceitos complicados" _after_ this exact tooltip fix shipped (`docs/plans/documentacao-conceitos-campanha.md`).                    |
| 3         | User Control and Freedom            | 3         | Popover/tooltip dismiss cleanly (Escape, click-outside, blur); no traps.                                                                                                                                                                                                       |
| 4         | Consistency and Standards           | 2         | Two disclosure idioms collide in one card: `CampaignInfoHint` opens-on-click-and-stays-open; the metric `Tooltip` closes-on-click and never opens on click. A user primed by the "?" icon one line above will click a metric next and get nothing, or dismiss an open tooltip. |
| 5         | Error Prevention                    | 3         | n/a mostly (read-only diagnostics); sane zero/negative fallbacks ("Sem meta definida," "Sem teto do campo projetado...").                                                                                                                                                      |
| 6         | Recognition Rather Than Recall      | 2         | Dotted-underline is a fair desktop cue, but on touch there is **no cue at all** — confirmed by both assessments (Radix's own touch-suppression logic, and no tap affordance reachable at 390×844).                                                                             |
| 7         | Flexibility and Efficiency of Use   | 3         | `Tab` reaches every metric and opens its tooltip on focus with a visible ring — solid keyboard path, measured live.                                                                                                                                                            |
| 8         | Aesthetic and Minimalist Design     | 3         | Restrained, on-brand, correctly dense for a staff surface; undermined live by the tooltip/popover collision covering sibling content (screenshotted at both desktop and 390px).                                                                                                |
| 9         | Error Recovery                      | 3         | n/a — no error states exercised; fallback copy is clear and non-technical.                                                                                                                                                                                                     |
| 10        | Help and Documentation              | 2         | Good _density_ of contextual help (card popover + 4 inline tooltips), not yet _effective_ — field evidence says the explanations didn't resolve confusion, and there's no link to deeper docs yet (that's roadmap E18).                                                        |
| **Total** |                                     | **26/40** | **Acceptable — significant improvements needed before users are happy**                                                                                                                                                                                                        |

## Anti-Patterns Verdict

**LLM assessment**: Not AI slop. This is a real derived-data card built on the existing token system — flat `rounded-xl` card, hairline border, stone/red restraint, `tabular-nums`, dotted-underline instead of a fifth icon button. No purple-gradient/hero-metric/generic-SaaS tells. The actual risk is the opposite: the tooltip follow-up added this session has the texture of a fast patch (dense unbroken-paragraph copy, a disclosure-pattern collision) rather than a considered craft pass.

**Deterministic scan**: `detect.mjs --json` against the three target files (`MunicipalityGoalAccountCard.tsx`, `CampaignInfoHint.tsx`, `MunicipalityHoverTooltip.tsx`) returned **exit 0, zero findings** — the code itself carries no static anti-pattern signatures. The bundled live-overlay injection (`live-server.mjs` + `detect.js`) separately surfaced 7 **page-wide** console findings (line-length ~135 chars/line, overused/single-font Inter, one `layout-transition: height`, and `nested-cards` ×3) — these scan the whole rendered page (header/sidebar included) and are **not confirmed scoped to the 3 target files**; treat as pre-existing shell-level context, not new debt from this session's work. One `nested-cards` hit plausibly matches this card's own "Votos estimados" `rounded-lg bg-muted/40` box sitting inside the card's `rounded-xl border` section, but this wasn't isolated with certainty.

**Visual overlays**: No standing overlay was left running — the live-server was started, injected, read, and stopped as part of the evidence-gathering process; nothing persists in your browser to check.

## Overall Impression

The card itself is well-crafted and on-brand — restrained, honest about data provenance, and genuinely keyboard-accessible. But the tooltip follow-up built this session to fix a real comprehension gap **does not work at all on touch**, and where it does work, the bubble physically covers the "Cobertura da meta" figure it's meant to clarify. Both are P1s confirmed with hard evidence (Radix's own source, live screenshots at two viewports), not opinion. The biggest opportunity is recognizing that hover/focus disclosure may be the wrong mechanism for this density of explanation in the first place — worth weighing before this pattern gets copied onto more metrics as E9–E17 land.

## What's Working

1. **`CampaignInfoHint`'s copy is intellectually honest**: "Comprometido é só a soma das declarações de lideranças — nunca a meta," plus the explicit 2022-only caveat for roll-off/teto do campo. It pre-answers the obvious follow-up and admits data limitations instead of hiding them.
2. **Keyboard accessibility of the metric tooltips is genuinely solid, not a token gesture**: `tabIndex={0}` + a visible Mandate-Red `focus-visible` ring + tooltip opening on focus with proper `aria-describedby` — verified live via real `Tab` navigation.
3. **On-brand restraint**: flat card, hairline border, `tabular-nums`, dotted-underline instead of a fifth "?" icon — respects the Signal Red Rule (red stays on "Editar") and Flat-By-Default. Tooltip contrast measured at 17.49:1 (white on near-black) — no readability issue once a tooltip is actually visible.

## Priority Issues

**[P1] Touch users cannot open the metric tooltips at all.**

- **Why it matters**: PRODUCT.md names "used in the field and on the go" as this surface's defining context, and this exact follow-up exists for comprehension. It's unreachable on the device class that context implies.
- **What/evidence**: `@radix-ui/react-tooltip@1.2.8`'s `TooltipTrigger` explicitly ignores touch pointer events and gates focus-open on a pointer-down ref that a tap sets first — confirmed against the installed source, not inference. At 390×844, no tap affordance exists for any of the 4 metrics; the adjacent "Editar votos estimados" control works fine at the same width, so this reads as an oversight, not a deliberate mobile choice.
- **Fix**: Add an explicit tap trigger — drop `asChild` for a focusable/clickable element with its own `onClick` toggling open, or give each metric a small click-openable affordance like `CampaignInfoHint`'s.
- **Suggested command**: `/impeccable harden`

**[P1] Tooltips render on top of the number/coverage block they explain.**

- **Why it matters**: The moment someone seeks clarification is the moment the clarified figure disappears — a direct "one thing at a time" violation at the card's highest-stakes row.
- **What/evidence**: Reproduced independently by both assessments via hover, real keyboard focus, and screenshots at 1280×720 and 390×844 — the bubble (Radix collision-flips to `data-side="top"` since the trigger sits near the viewport bottom) fully covers "Cobertura da meta" / the progress bar / "Faltam X votos para a meta" at both widths.
- **Fix**: Force collision-safe placement for this usage (`side="top"` with generous `sideOffset` plus bottom padding, or reorder the diagnostic row above the coverage block so there's room for the tooltip to open without overlap).
- **Suggested command**: `/impeccable layout`

**[P1] Tooltip/popover copy is dense, cross-referential jargon — and the real user already said it didn't help.**

- **Why it matters**: `docs/plans/documentacao-conceitos-campanha.md` quotes the actual coordinator calling these "conceitos complicados" _after_ these exact tooltips shipped — the fix under critique didn't fix the problem it was built to fix.
- **What/evidence**: e.g. the "Teto do campo" explanation is one ~40-word sentence with three technical terms and no break; "Share intracampo"'s explanation requires recalling "Captura"'s definition mid-read, but the two tooltips can never be open at the same time (opening one closes the other) — a genuine working-memory violation.
- **Fix**: Split each explanation into a short lead sentence (what it measures) + a visually secondary formula line; bold only the one term each tooltip defines; stop cross-referencing metrics that can't be open simultaneously — state the difference inline instead of by reference.
- **Suggested command**: `/impeccable clarify`

**[P2] Two incompatible disclosure idioms coexist in one card.**

- **Why it matters**: Breaking Consistency _within_ a single component teaches the wrong mental model in real time — a user who just learned "click the small icon" naturally tries clicking a metric next and gets nothing or an unwanted dismissal.
- **What/evidence**: `CampaignInfoHint` = click-to-open-and-stay-open Popover; `GoalAccountMetric` = hover/focus Tooltip that closes on click (Radix default), never opens on click.
- **Fix**: Pick one idiom for this card, or make the "click for detail" vs. "hover/focus for definition" visual distinction stronger than dotted-underline vs. circle-icon alone.
- **Suggested command**: `/impeccable clarify`

**[P3] The 0%-coverage progress bar is nearly invisible.**

- **Why it matters**: Understates urgency exactly when it should read loudest (0% coverage is the most common early-campaign state).
- **Fix**: Give the near-zero state deliberate visual weight instead of relying solely on the adjacent "0%" text.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Alex (Impatient Power User — the coordinator in the weekly meeting)**: Wants "does the account close" in one glance; instead has to learn two disclosure idioms in the same card, and hovering a diagnostic metric to double-check a number before reporting it upward covers that exact number with the tooltip bubble.

**Sam (Accessibility-Dependent, keyboard/screen reader)**: Genuinely well-served on keyboard (visible focus ring, `Tab` reaches every metric, proper `aria-describedby`). Red flag: nothing in the accessible name/role of the `tabIndex={0}` wrapper signals "this one has extra content" in advance — unlike `CampaignInfoHint`, which is an explicitly-named button — so a screen-reader user has to tab-and-listen speculatively.

**Casey (Distracted Mobile User — "field and on the go")**: Confirmed dead end. Tapping any of the 4 metrics mid-conversation with a leadership contact produces silence — no tooltip, no feedback, no error — verified against Radix's own touch-suppression logic and a live 390×844 render. The adjacent "Editar votos estimados" control works fine at the same width, so the gap reads as an oversight, not a deliberate choice.

## Minor Observations

- Inconsistent naming for the same race across the card: "deputado federal," "DF," and the card's own title "cadeira" all mean the same office; a first-time reader must infer the synonymy.
- `CampaignInfoHint`'s popover runs three distinct ideas (meta/comprometido/2022-only caveat) into one unbroken `<p>` — a blank line between them would help scanning under pressure.
- Measured: the "?" button is exactly 44×44px (meets the enhanced WCAG 2.2 target size); the 4 metric touch-target wrappers measured only 36px tall — below that same bar, compounding the touch dead-end above rather than causing it.
- Measured: metric label contrast (`text-muted-foreground`, 12px) is ≈4.83:1 — passes AA (≥4.5:1) but with a thin 0.33 margin; tooltip content itself measured 17.49:1, no issue there.
- `sm:grid-cols-4` collapses to 2×2 below `sm`; mid-size tablet/foldable widths weren't tested and are worth a pass as more metrics join this row (E9–E17).

## Questions to Consider

- If the coordinator needed a _separate_ documentation surface (E18) days after these exact tooltips shipped specifically because they didn't resolve the confusion, is hover/focus disclosure the right mechanism for this density of explanation at all — or does the card need one worked example inline before a glossary page ever ships?
- "Captura" and "Share intracampo" exist as two numbers whose entire tooltip copy is dedicated to explaining how they differ from each other — should this be one metric with a denominator toggle instead of two numbers that each require reading the other's footnote?
- As E9–E17 add more diagnostic metrics to this row, does the card need a settled disclosure model _now_ — before there are 8 metrics fighting over two incompatible idioms instead of 4?
