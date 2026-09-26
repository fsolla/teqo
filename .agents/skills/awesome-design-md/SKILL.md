---
name: awesome-design-md
description: Reference library of DESIGN.md files extracted from real websites (Stripe, Linear, Vercel, Figma, Apple, WIRED, ...). Use when creating or evolving a DESIGN.md, exploring a new visual direction, or when asked to make a surface "look like <site>" — harvest patterns, never clone identity.
---

# Awesome DESIGN.md — reference library

Curated by VoltAgent: <https://github.com/VoltAgent/awesome-design-md>. 73 `DESIGN.md` files following Google Stitch's [DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/specification/): visual theme, color roles, typography hierarchy, component styling, layout, elevation, do's/don'ts, responsive behavior, agent prompt guide.

## Fetching a reference

Raw file (preferred — clean markdown):

```
curl -fsSL https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<slug>/DESIGN.md
```

The slug index lives in the repo README collection section; rendered previews (color swatches, type scale, light/dark) are at `https://getdesign.md/<slug>/design-md`.

## How to use it in Teqo

- **Teqo's root `DESIGN.md` is the living owner.** Never overwrite it with a reference — merge the patterns that survive judgment and record the rationale in `DESIGN.md` §7 (Evolution).
- Harvest what transfers — type scale, spacing rhythm, elevation logic, component states, motion discipline — and translate into Teqo's token contract (`data-theme`, shadcn tokens) instead of copying hex values verbatim.
- **Copy the craft, not the identity:** don't clone third-party brands (logos, wordmarks, proprietary typefaces as Teqo's identity, exact palettes as our brand). Trademarks aren't ours.
- The `/campanha` desk is an operate surface: prefer dense-product references (Linear, Sanity, PostHog, ClickHouse) over marketing sites.
- Public/persuade surfaces (site, campaign page) can use editorial and marketing references.
- `PRODUCT.md` (positioning, personality, anti-references) wins over any reference.

## When not to use

- Not a checklist: pair with `web-design-guidelines` for compliance and `design-taste-frontend` / `impeccable` for execution.
- Not a source of truth for Teqo tokens — those live in the code (`data-theme` blocks) and `DESIGN.md`.
