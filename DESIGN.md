---
name: Teqo
description: Field ops and public voice for Jorge Solla — campaign desk first, owned channel second.
colors:
  primary: '#c51414'
  primary-foreground: '#ffffff'
  brand-header: '#ae1603'
  brand-header-foreground: '#fff8f2'
  background: '#ffffff'
  foreground: '#1c1917'
  card: '#ffffff'
  muted: '#f4f4f5'
  muted-foreground: '#6b7280'
  secondary: '#f5f5f4'
  secondary-foreground: '#292524'
  accent: '#f4f4f5'
  accent-foreground: '#1c1917'
  border: '#e7e5e4'
  input: '#d6d3d1'
  ring: '#c51414'
  destructive: '#b42318'
  sidebar: '#fafaf9'
  sidebar-foreground: '#1c1917'
  scope: '#fff5ed'
  scope-foreground: '#6b2d15'
  support-engaged: '#dcfce7'
  support-engaged-foreground: '#166534'
  support-disputed: '#fef3c7'
  support-disputed-foreground: '#92400e'
  support-negative: '#fee2e2'
  support-negative-foreground: '#991b1b'
  estimate-confirmed: '#dcfce7'
  estimate-confirmed-foreground: '#166534'
  estimate-pending: '#fef3c7'
  estimate-pending-foreground: '#92400e'
  cadence-overdue: '#b42318'
  editorial-bg: '#f6f4f3'
  editorial-fg: '#201b1a'
  petition-bg: '#fff8f2'
  petition-cta: '#ffcf2e'
  petition-cta-foreground: '#332300'
typography:
  headline:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 10px'
    height: '32px'
    typography: '{typography.label}'
  button-primary-hover:
    backgroundColor: '#c51414cc'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 10px'
    height: '32px'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 10px'
    height: '32px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    padding: '8px 10px'
    height: '32px'
  input-field:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '32px'
  badge-status:
    backgroundColor: '{colors.muted}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
    height: '20px'
    typography: '{typography.label}'
  card-surface:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.xl}'
    padding: '16px'
---

# Design System: Teqo

## 1. Overview

**Creative North Star: "The Field Desk"**

Teqo’s visual system is a sober ops surface for people organizing under pressure. Design defaults to `/campanha`: stone-white surfaces, Inter, and brand red as a **signal** (primary actions, selection, status urgency) — never as spectacle or brochure chrome. Staff screens can be information-dense; leadership paths stay phone-first with larger touch targets and obvious next actions.

Public themes (`editorial`, `petition`, and the home brand-red body) share the same token contract and primary red, but they are surface variants. When inventing new UI, start from the campaign desk unless the task is explicitly a public/marketing page.

The system rejects generic SaaS dashboards (purple gradients, hero-metric templates, identical card grids, AI-startup chrome) and traditional Brazilian campaign kitsch (clipart flags, shouty all-caps, brochure clutter). Sovereignty and clarity beat decoration.

**Key Characteristics:**

- Product register: familiar shadcn affordances, earned consistency over surprise
- Restrained color strategy: neutrals dominate; primary red ≤ ~10% of any screen
- Hybrid elevation: flat lists/forms; light lift only for priority or overlay surfaces
- Confident and compact controls — denser desktop, phone-first leadership paths
- Semantic status colors (support / estimate / cadence) carry meaning, not fashion

## 2. Colors

A stone-neutral desk with one mobilizing red. Semantic pastels mark operational state; they never replace the primary action color.

### Primary

- **Mandate Red** (`#c51414`): Primary buttons, focus rings, active nav, brand emphasis on `/campanha` and editorial/petition themes. Use for the one clear next action.
- **Header Crimson** (`#ae1603`): Public site header bar (`--site-header`) and home body gradient anchor — inherited across themes so the masthead stays constant.

### Secondary

- **Stone Wash** (`#f5f5f4` / `#f4f4f5`): Secondary buttons, muted fills, hover washes. Quiet structure, not a second brand.

### Tertiary

- **Petition Gold** (`#ffcf2e`): Petition-theme CTA only (`data-theme='petition'`). Forbidden as a general accent on campaign screens.

### Neutral

- **Desk White** (`#ffffff`): Page and card background on campaign.
- **Ink Stone** (`#1c1917`): Body text and strong labels.
- **Quiet Ink** (`#6b7280`): Muted labels, secondary metadata — keep contrast ≥ 4.5:1 on white.
- **Hairline Stone** (`#e7e5e4` / `rgb(28 25 23 / 12%)`): Borders and dividers.
- **Field Border** (`#d6d3d1`): Visible input stroke on white cards.
- **Rail Mist** (`#fafaf9`): Campaign sidebar rail.

### Semantic (campaign ops)

- Scope / territory chips: warm peach (`#fff5ed` / `#6b2d15`)
- Support & estimates: green engaged/confirmed, amber disputed/pending, red negative/overdue — use only via Badge variants, never invent parallel hues

### Named Rules

**The Signal Red Rule.** Mandate Red is for primary action, focus, and urgency. It must not wash backgrounds, decorate cards, or paint inactive chrome.

**The Theme Contract Rule.** New surfaces reuse the shadcn token names (`primary`, `muted`, `field-*`, etc.). Do not introduce one-off hex outside a `data-theme` block.

## 3. Typography

**Display Font:** Inter (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Inter (same stack)
**Label/Mono Font:** Inter for UI labels; mono only for code snippets

**Character:** One tuned sans for the whole product desk — no display serif in app chrome. Public article heroes may use larger extrabold Inter; campaign headings stay left-aligned section titles.

### Hierarchy

- **Headline** (600, `1.5rem` / `text-2xl`, tight tracking): Page and section titles on `/campanha`.
- **Title** (500, `1rem` / `text-base`): Card titles, dialog titles.
- **Body** (400, `0.875rem` / `text-sm`, leading ~1.5): Default UI copy; prose max ~65–75ch when reading length matters.
- **Label** (500, `0.75rem` / `text-xs`): Badges, meta, table headers. Never all-caps tracked eyebrows as section scaffolding.

### Named Rules

**The One Family Rule.** Inter everywhere in product UI. No decorative display faces in buttons, labels, or data.

**The Fixed Scale Rule.** Prefer rem/Tailwind steps over fluid `clamp()` headings inside the campaign shell.

## 4. Elevation

Hybrid: most of the desk is flat. Depth comes from tonal layers (sidebar rail, muted fills, hairline rings) and from overlays when the user must focus.

Lists, forms, filters, and table rows stay flat. Cards may use a light ring (`ring-1 ring-foreground/10`) without drop shadow. Soft ambient lift is reserved for priority overview panels and for floating UI (dialogs, sheets, drawers, popovers).

### Shadow Vocabulary

- **Flat desk** (no shadow): Default for rows, forms, filters, most cards.
- **Priority lift** (soft ambient, low opacity): Overview / insight panels that must read as “above” the list — keep blur soft and shadow light; if it looks like a 2014 app, the shadow is too dark.
- **Overlay** (modal/sheet/popover system shadow): Only for temporary focus layers.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Lift appears for priority or overlay — never as default card decoration across a grid.

## 5. Components

Controls feel **confident and compact**: short primary buttons, dense toolbars, phone-first tap targets where leaderships work.

### Buttons

- **Shape:** Gently rounded (`rounded-lg` ≈ 8px; smaller sizes clamp toward `--radius-md`)
- **Primary:** Mandate Red fill, white text, height 32px default; primary submit may use `font-bold`
- **Hover / Focus:** Primary hover at ~80% opacity; focus-visible ring `ring-3 ring-ring/50` with border-ring
- **Secondary / Outline / Ghost / Destructive:** Standard shadcn variants; destructive is tinted text/fill, not a second brand red for routine actions
- **Active:** Slight `translate-y-px` press

### Chips / Badges

- **Style:** Pill (`rounded-4xl`), height 20px, `text-xs` medium
- **State:** Semantic variants (`support-*`, `estimate-*`, `scope`, `tse`) — status meaning only; do not invent decorative chip colors

### Cards / Containers

- **Corner Style:** `rounded-xl` (~12px)
- **Background:** Card white on desk white — separation via hairline ring, not heavy shadow
- **Shadow Strategy:** Flat by default; priority lift only when the panel is an overview/insight surface
- **Internal Padding:** `--card-spacing` default 16px (`spacing(4)`), sm 12px

### Inputs / Fields

- **Style:** Campaign forces `--radius-md` (~6px) on input/select triggers (overrides public `rounded-full` input). Visible `--field-border` on white.
- **Focus:** Border primary + `ring-3 ring-primary/30`
- **Error / Disabled:** Destructive border/ring; disabled uses field-disabled tokens at reduced opacity
- **Touch:** Keep leadership-facing controls generous; public Input uses larger py for form comfort

### Navigation

- **Campaign shell:** Light stone sidebar rail on desktop; mobile top bar in Mandate Red with white wordmark — intentional field-mode contrast (phone in the street vs desk rail), not Signal Red Rule drift.
- **Active:** Primary-tinted or bold text — red signals location, not decoration
- **Public header:** Header Crimson bar, constant across themes

### Status Badge (signature)

Operational meaning for leadership/support/estimates. Always use `Badge` variants tied to CSS tokens — never hardcode greens/ambers that drift from `--support-*` / `--estimate-*`.

### Campaign list system (Pass 2 W1 — canonical, do not fork)

Every `/campanha` list surface composes the shared pieces in `src/components/campaign/shared/`: `CampaignTable` (columns as data over house `ui/Table`; `rounded-xl border` container), `CampaignSearchForm` / `CampaignFilterChips` as the toolbar, `CampaignListFooter` (count + pagination), `CampaignListEmptyState` (`Empty` with icon + CTA, `min-h-72 border`), all inside `CampaignListPendingBoundary` so navigation dims the RESULTS region ("Feel the action"). Rich headers (sort + filter popovers) are the municipality islands (`MunicipalitySortableHead`/`MunicipalityHeaderFilter`) — the reference implementation, not yet generalized. New list = new column definitions + these shells; a bespoke table needs a documented exception (precedents: planos cards, `TerritoryOverviewTable`).

## 6. Do's and Don'ts

### Do:

- **Do** treat `/campanha` as the design default: stone desk, Inter, Signal Red for the next action.
- **Do** keep primary red rare — one clear CTA per region beats a sea of red buttons.
- **Do** use semantic Badge tokens for support/estimate/cadence state.
- **Do** keep leadership paths phone-first: obvious actions, larger taps, plain language.
- **Do** meet WCAG 2.2 AA (contrast, keyboard, focus rings, `prefers-reduced-motion`).
- **Do** reuse shadcn primitives (`Button`, `Input`, `Badge`, `Card`, dialogs/sheets) for consistency.

### Don't:

- **Don't** ship generic SaaS dashboards — purple gradients, hero-metric templates, identical card grids, AI-startup chrome.
- **Don't** ship traditional Brazilian campaign kitsch — clipart flags, shouty all-caps, brochure clutter.
- **Don't** use side-stripe borders (`border-left`/`border-right` > 1px) as accent decoration.
- **Don't** use gradient text or glassmorphism as default chrome.
- **Don't** put tiny uppercase tracked eyebrows above every section.
- **Don't** use Petition Gold or home body gradients inside the campaign desk.
- **Don't** invent display fonts for UI labels, buttons, or data.
- **Don't** lift every card; flat is the desk’s resting state.
