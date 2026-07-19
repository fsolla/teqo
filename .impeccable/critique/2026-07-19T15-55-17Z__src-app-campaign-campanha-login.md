---
target: /campanha/login
total_score: 32
p0_count: 0
p1_count: 0
p2_count: 2
timestamp: 2026-07-19T15-55-17Z
slug: src-app-campaign-campanha-login
---
Method: dual-agent (A: 103923c2-0d00-49d5-9902-eee91515fbc5 · B: c71afcf4-ae05-432e-900f-a93610cb29a4)

# Critique: /campanha/login (post-polish)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Spinner + aria-live; FieldError alert + aria-invalid/describedby on both fields |
| 2 | Match System / Real World | 3 | Dual-path copy clear; description still leads with email before phone; forgot remains email-only |
| 3 | User Control and Freedom | 3 | Forgot link exists; no show-password; no staff/liderança switch |
| 4 | Consistency and Standards | 4 | CampaignAuthPageShell + shared heading class; w-full matches siblings |
| 5 | Error Prevention | 3 | Dynamic inputMode after typing; empty field still inputMode=text |
| 6 | Recognition Rather Than Recall | 4 | Phone-first placeholder; standard login IA |
| 7 | Flexibility and Efficiency | 2 | Single rigid credential path |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained Field Desk; Signal Red budget OK; header slightly dense |
| 9 | Error Recovery | 3 | Generic error + leadership recovery hint; hint not in aria-describedby |
| 10 | Help and Documentation | 3 | First-access WhatsApp tip onboarded; phone recovery still partly error-gated |
| **Total** | | **32/40** | **Good** (+4 vs prior 28) |

## Anti-Patterns Verdict

**LLM:** Not AI slop. Field Desk card on muted; Megaphone mark; Mandate Red as signal only. Residual dual-path ambiguity and emotional flatness, not template aesthetics.

**Deterministic scan:** detect.mjs exit 0, **0 findings** on login dir + shell + campaignAuthCopy.

**Visual overlays:** No reliable overlay. Browser MCP failed; live-server/inject infra worked (port 8400) but detect.js never ran. Curl confirmed 200 + structure (h1, min-h-11, w-full, a11y attrs).

## Overall Impression

Prior P1/P2 gaps closed: real h1, mobilizing title, phone-first placeholder, first-access tip, field-linked errors, recovery hint, shared shell. Biggest remaining opportunity: make the empty-field mobile keyboard and forgot-password funnel as phone-first as the rest of the screen.

## What's Working

1. Real `<h1>` + FieldError association (Sam P1 closed).
2. First-access WhatsApp invite line without branching UI.
3. Auth-chain consistency via CampaignAuthPageShell + full-width touch targets.

## Priority Issues

### [P2] Empty-field keyboard not phone-first
- **What:** identifierInputMode('') → 'text'; tel only after ≥2 digits.
- **Why:** Leadership first tap still gets QWERTY.
- **Fix:** Default inputMode=tel when empty; switch to email on @.
- **Suggested command:** `/impeccable adapt /campanha/login`

### [P2] No show-password toggle
- **What:** password type only.
- **Why:** One-handed field re-entry under glare.
- **Fix:** Reveal toggle with aria-pressed, keep min-h-11.
- **Suggested command:** `/impeccable harden /campanha/login`

### [P3] Recovery hint outside aria-describedby
- **What:** Only login-credentials-error is described; CAMPAIGN_LEADERSHIP_LOGIN_RECOVERY_HINT is a sibling p.
- **Why:** SR may miss phone-only guidance.
- **Fix:** Append hint id to aria-describedby.
- **Suggested command:** `/impeccable harden /campanha/login`

### [P3] “Esqueceu a senha?” still email-first funnel
- **What:** Link unlabeled as email-only; phone users hit forgot then discover coordinator path.
- **Why:** Reflex after one failed attempt.
- **Fix:** Sub-label or always-visible CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT near link.
- **Suggested command:** `/impeccable clarify /campanha/login`

### [P3] Emotional register still flat vs “inspiring”
- **What:** Clear ops gate; no trust/solidarity line.
- **Why:** Field Desk asks for socialist/clear/inspiring.
- **Fix:** One grounded trust line without kitsch.
- **Suggested command:** `/impeccable delight /campanha/login` or `/impeccable clarify`

## Persona Red Flags

**Jordan:** Improved; still assumes “núcleo”/“coordenador” literacy.
**Sam:** h1 fixed; recovery hint not in describedby.
**Casey:** Targets pass; empty inputMode=text; no show-password.
**Field leadership:** Best-improved; still at risk from unqualified forgot link + email-first description ordering.

## Minor Observations

- Three header text blocks — purposeful but dense on narrow screens.
- Brand row not in heading hierarchy (OK with card h1).
- Cognitive load still 2 failures (moderate): dual credential model; phone recovery partly progressive.

## Questions to Consider

1. Default empty identifier to tel?
2. Always-visible leadership recovery near forgot link?
3. Split Sou equipe / Sou liderança still worth it?
4. One inspiring trust line on a login gate — yes or overreach?
5. Relabel “Esqueceu a senha?” for email-only accounts?
