---
target: /campanha/login
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T15-10-58Z
slug: src-app-campaign-campanha-login
---
Method: dual-agent (A: cd378fde-c091-463a-8e89-ca6cecac8904 · B: 44f7668c-1143-41ec-a147-a2dc2f4d7f9c)

# Critique: /campanha/login

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending state is clear (Spinner + “Entrando…”); auth failure is a single generic FieldError not tied to fields |
| 2 | Match System / Real World | 3 | “E-mail ou celular” matches dual auth, but leadership phone path vs email-only reset is invisible on this screen |
| 3 | User Control and Freedom | 3 | Forgot-password link exists; no show-password, no first-access/invite escape |
| 4 | Consistency and Standards | 3 | Auth shell duplicated across login/esqueci/redefinir; Entrar lacks `w-full` unlike sibling forms |
| 5 | Error Prevention | 2 | `inputMode="email"` on a dual identifier; validation authoritative only on server with generic messages |
| 6 | Recognition Rather Than Recall | 4 | Standard login IA; placeholder shows both formats |
| 7 | Flexibility and Efficiency | 2 | Single rigid credential path; no returning-user / PWA shortcut |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained Field Desk card on muted; Signal Red budget respected |
| 9 | Error Recovery | 3 | Generic security error is correct but offers no next-step branch for phone-only / invite users |
| 10 | Help and Documentation | 1 | Zero first-timer guidance on login; forgot-password already explains phone→coordenador invite |
| **Total** | | **28/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment**: Not AI slop. Centered card on `bg-muted`, Megaphone-in-primary square, Inter/stone tokens — reads as restrained shadcn Field Desk, not SaaS purple or campaign brochure. Absolute bans (side-stripe, gradient text, glassmorphism, hero-metric, eyebrow scaffolding) absent. Weakness is emotional flatness and leadership-path ambiguity, not template aesthetics.

**Deterministic scan**: `detect.mjs --json` on `src/app/(campaign)/campanha/login` → exit 0, **0 findings** (`[]`). Per-file scans of `page.tsx` and `LoginForm.tsx` also clean. Detector and LLM agree: no automated slop families.

**Visual overlays**: No reliable user-visible overlay. Browser MCP (`plugin-browse-browser`) failed on navigate/snapshot; live-server injection skipped. Dev server was serving `http://localhost:3000/campanha/login` (200). Layout confirmed from source + served HTML: muted full-viewport center, brand row, card with identifier/password, “Esqueceu a senha?”, primary “Entrar”.

## Overall Impression

A clean, trustworthy ops gate that earns familiarity — then stalls for the people who need it most under pressure. Biggest opportunity: make the leadership (phone / invite) path as discoverable as the staff (email) path without cluttering the desk.

## What's Working

1. **Touch targets**: Inputs and submit use `min-h-11` (44px) — meets field/leadership phone bar.
2. **Signal Red discipline**: Red only on mark, primary CTA, focus ring, and forgot link — not washed across the canvas.
3. **Pending feedback**: `disabled={pending}`, Spinner, `aria-live="polite"` label swap to “Entrando…”.

## Priority Issues

### [P1] Missing document heading landmark
- **What**: `CardTitle` is a `<div>`; page has no `<h1>`. Brand row is plain `font-semibold` text.
- **Why it matters**: Screen-reader users get no clear “where am I” on a critical entry screen; weak WCAG structure.
- **Fix**: Promote “Acessar painel” (or a sr-only “Entrar — Campanha”) to a real `<h1>`.
- **Suggested command**: `/impeccable harden /campanha/login`

### [P1] Phone-first leadership mismatch
- **What**: Identifier uses `inputMode="email"` while leadership auth is phone-as-username; “Esqueceu a senha?” leads to email-only reset that already tells phone users to ask a coordinator — but login itself is silent.
- **Why it matters**: Field leadership gets the wrong keyboard, fails auth, then hits an email form that abandons them.
- **Fix**: Prefer `inputMode="tel"` or pattern-aware mode; add one line of login copy mirroring `ForgotPasswordForm` (“Liderança: celular cadastrado. Sem senha? Peça convite ao coordenador.”).
- **Suggested command**: `/impeccable clarify /campanha/login`

### [P2] Monolithic auth error with no recovery branches
- **What**: `state.error` (“E-mail, celular ou senha inválidos.” / “Dados inválidos.”) sits in one `FieldError` above submit, not linked via `aria-describedby` / `aria-invalid`.
- **Why it matters**: Under pressure users retype everything; no path to invite vs reset.
- **Fix**: Keep message generic for security; add `aria-invalid` + recovery links (esqueci-senha / first-access invite guidance).
- **Suggested command**: `/impeccable harden /campanha/login`

### [P2] No first-timer guidance on the login surface
- **What**: “Campanha” + Megaphone + “Acessar painel” assumes prior context; invite flow undiscoverable.
- **Why it matters**: Jordan abandons; leadership thinks the product is broken when they need a WhatsApp invite.
- **Fix**: One sentence under CardDescription: who this is for + what to do on first access.
- **Suggested command**: `/impeccable onboard /campanha/login` or `/impeccable clarify /campanha/login`

### [P3] Submit width inconsistent with sibling auth forms
- **What**: Login `Button` is `min-h-11` without `w-full`; forgot/reset use `min-h-11 w-full`.
- **Why it matters**: Thumb-target inconsistency on phone; visual drift across auth chain.
- **Fix**: Add `w-full`; extract shared `CampaignAuthPageShell` (already on RS+ backlog).
- **Suggested command**: `/impeccable polish /campanha/login`

## Persona Red Flags

**Jordan (First-Timer)**: No product/first-access explanation; dual “E-mail ou celular” forces a format guess; after error, no “try next” guidance; invite path invisible.

**Sam (Accessibility)**: No `<h1>`; CardTitle/Description are divs; error alert not associated with inputs; pending state is announced but field-level invalid state is not.

**Casey (Distracted Mobile)**: Touch targets pass and CTA is low on the card (good); `inputMode="email"` hurts phone typing; no show-password for one-handed re-entry.

**Field leadership on phone (project)**: Phone-as-username is core product behavior, but copy leads with e-mail, reset abandons them, and tone (“painel”) reads admin portal not peer field tool.

## Minor Observations

- Auth shell triplicated (`login` / `esqueci-senha` / `redefinir-senha`); invalid-token reset can drop brand header — shell would prevent drift.
- Placeholder `voce@exemplo.com ou (71) 99999-1234` helps staff more than leadership.
- `robots: noindex` and campaign theme tokens correctly applied.
- Cognitive load: **2 failures (moderate)** — working memory (email vs phone mental model) and progressive disclosure (invite path hidden until forgot-password).

## Questions to Consider

1. Split “Sou equipe” / “Sou liderança” vs keep one identifier field?
2. Is “Acessar painel” the right frame, or “Entrar na campanha” / field-desk language?
3. Why educate phone users only on forgot-password — intentional funnel or debt?
4. Would one trust line (data used only for campaign org) reduce abandonment without kitsch?
