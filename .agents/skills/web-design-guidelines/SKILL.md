---
name: web-design-guidelines
description: Review UI code against the Vercel Web Interface Guidelines — accessibility, focus states, forms, animation, typography, images, performance, navigation/state, touch, safe areas, dark mode, locale/i18n, hydration. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
---

# Web Interface Guidelines review

Read-only review of UI code against the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). Output is a terse `file:line` findings list.

## Rules source

The full ruleset is vendored at [guidelines.md](guidelines.md) (fetched from `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` on 2026-09-26). Read it before each review — it carries both the rules and the output format.

Refresh only when asked (the vendored copy is the stable default; a failed fetch must never block the review):

```
curl -fsSL https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md -o .agents/skills/web-design-guidelines/guidelines.md
```

## How it works

1. Read `guidelines.md` (all rules + output format).
2. Read the target files (argument or explicit list; ask if none given).
3. Check every rule against every file. Report `file:line` findings grouped by file; `✓ pass` for clean files; no preamble; skip explanation unless the fix is non-obvious.

## Precedence (Teqo)

- These guidelines are the **accessibility/UX/performance floor** — they always apply, including to `/campanha`.
- Teqo's `DESIGN.md` owns visual identity and may be more specific. When a guideline conflicts with a deliberate DESIGN.md decision, report the conflict explicitly instead of silently dropping either side.
- This is a review lens, not a design doctrine: it never overrides the hi-fi gate artifact or the evolution rules in `DESIGN.md` §7.

## Never

- Never edit code as part of the review unless the user asks for fixes — the deliverable is findings.
- Never flag house decisions (shadcn variants, campaign themes, semantic badge tokens) as violations without checking `DESIGN.md` first.
