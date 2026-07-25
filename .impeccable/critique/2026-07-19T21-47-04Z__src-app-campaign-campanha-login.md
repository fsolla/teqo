---
target: /campanha/login
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T21-47-04Z
slug: src-app-campaign-campanha-login
---

# Critique: /campanha/login

Method: dual-agent (A: 8a8b1ae0-9a8a-45f7-907f-54afcdf62db8 · B: 3899acad-4f36-4817-91d6-4135d72d2e96)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                        |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Pending state clear; no other status chrome                      |
| 2         | Match System / Real World       | 3         | PT-BR + e-mail/celular fit; megaphone mark generic               |
| 3         | User Control and Freedom        | 2         | Only “Esqueceu a senha?”; no exit to public site                 |
| 4         | Consistency and Standards       | 2         | h1 left vs centered muted copy; leading clash                    |
| 5         | Error Prevention                | 2         | required + inputMode help; dual identifier still easy to mistype |
| 6         | Recognition Rather Than Recall  | 3         | Labels/placeholder clear                                         |
| 7         | Flexibility and Efficiency      | 3         | E-mail or phone + adaptive inputMode                             |
| 8         | Aesthetic and Minimalist Design | 2         | Header rhythm/alignment + always-on help prose                   |
| 9         | Error Recovery                  | 3         | FieldError + leadership recovery hint                            |
| 10        | Help and Documentation          | 3         | Help exists; always-visible first-access competes                |
| **Total** |                                 | **26/40** | **Acceptable**                                                   |

## Anti-Patterns Verdict

**LLM:** Low–moderate slop. Not purple-SaaS; stock shadcn auth shell. Dual muted blurbs feel like copy padding. Typesetting bugs read unfinished.

**Detector CLI:** exit 0, 0 source findings on login + CampaignAuthPageShell.

**Runtime (Playwright inject):** `flat-type-hierarchy` (body; sizes 14/16/20px); `nested-cards` on CardHeader — likely false positive (shadcn Card > CardHeader).

## Overall Impression

Competent Field Desk palette discipline, phone-first form craft — undermined by a campaign-theme `h1 { text-align: left }` leak and article-style `p { leading-7 }` on auth copy. Biggest opportunity: fix header typesetting; do **not** add split-screen public posts.

## What's Working

1. Phone-first: min-h-11, enterKeyHint, identifierInputMode
2. Red as signal ≤10%
3. Auth-error recovery hint for liderança phone-only accounts

## Priority Issues

### P1 — Title misaligned with subtitle

Campaign `[data-theme='campaign'] h1 { text-align: left }` overrides CardHeader `text-center`. Title glyph start ~28px left of centered subtitle.
**Fix:** Scope left-align to app chrome, or `text-center` on auth heading.
**Command:** `/impeccable typeset` or `/impeccable layout`

### P1 — Subtitle vertical rhythm inverted

CardHeader `gap-1` (4px) between title and description; orphan `<p>` inherits base `leading-7` (28px) while CardDescription stays ~20px. Title glued to howto; second muted block breathes like article body.
**Fix:** One muted block with explicit leading-snug; bump title→desc gap; never bare `<p>` under campaign theme without leading override.
**Command:** `/impeccable layout` + `/impeccable typeset`

### P2 — Split-screen + public publications: recommend No

Login is ops gate (noindex); posts are public register. Phone users get scroll soup. Motivation ≠ news feed on unlock.
**Soft maybe:** one quiet purpose line under mark — not a publication panel.
**Command:** `/impeccable shape` only if product insists on panel (internal voice, not posts)

### P2 — Generic Megaphone mark

Not Solla / Field Desk identity.
**Command:** `/impeccable polish` (reuse campaign-logo)

### P3 — Always-on first-access paragraph

Progressive disclosure for returning users.
**Command:** `/impeccable distill` or `/impeccable clarify`

## Persona Red Flags

**Casey:** Misalignment reads broken; two gray blurbs delay thumb-to-input; split-screen would be fatal.
**Jordan:** Copy helps; visual hierarchy undercuts trust; no public-site escape.
**Lia:** Input path strong; header bugs tax one-handed use; keep error recovery; reject post panel.
**Sam:** Muted contrast scrapes AA (~4.83:1); labels/ARIA look solid.

## Minor Observations

- CardHeader grid-rows assumes 2 rows; third orphan `<p>` is API misuse
- Desktop narrow column is correct for this task
- Placeholder dual-format is heavy

## Questions to Consider

1. If the desk is the product, why does the door still look like every shadcn login?
2. Is “inspiring” one quiet line under the mark — or only after auth?
3. Would merging the two muted sentences fix more trust than any split-screen?
4. Who unlocks at 7am in a núcleo — why would they want a publication?
5. Why does auth inherit dashboard `h1` left-align rules?
