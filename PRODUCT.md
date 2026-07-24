# Product

## Register

product

## Platform

web

## Users

Two surfaces, one product.

**`/campanha` (primary for design defaults):** campaign coordination (`coordinator` "Coordenador Geral", `candidate` "Candidato", `advisor` "Assessor") and leaderships (`leader` "Liderança") — staff need depth for Municípios (435 predefined territories: one per Bahia municipality, except Salvador split into 19 TSE zones; Camaçari is a single whole municipality), people, declared-vs-estimated votes, dobradinhas, and agenda; leaderships use a phone-first supporter contact tool only (lockdown — no municipalities, pledges, demands, or election data). Advisors see only the municipalities they administer; candidate and coordinator see everything staff sees. Used in the field and on the go, often under time pressure through the 2026 calendar.

**Public site:** citizens and the base in Bahia first (news, petitions, donate, stay close to the mandate); institutional visitors second (press, partners, official voice).

## Product Purpose

**`/campanha`:** field operations and electoral intelligence as one job — municipalities, people, vote pledges, organizations, demands, dobradinhas, agenda, and share kits, plus a live picture of territory on the staff dashboard (map scaled by votes, year-over-year candidate comparison) so the team can prioritize action. Municipalities, people, and pledges live here as the system of record, even when outreach uses pragmatic channels.

**Public site:** own the relationship with the base first (engagement channel the campaign controls); project the mandate’s official voice and credibility second.

**Success near-term:** `/campanha` is the daily ops tool with real nuclei, people, and estimates in use, and the public site is the owned citizen channel — both live, not one or the other.

## Positioning

Sovereign political intelligence, organization, and community engagement — the destination. Pragmatic channels (e.g. WhatsApp) are acceptable shortcuts today; the product should not make those the permanent system of record.

## Brand Personality

Socialist, clear, inspiring.

Voice and UI should feel like tools built by people who believe a better internet and stronger grassroots organization are possible — functional and respectful (Mastodon), builders of owned channels (Automattic), willing to reimagine workflows when the old ones fail (Hey.com), and rooted in social mobilization practice (Bonde.org) — without pretending the team never uses the platforms people already live on.

## Anti-references

Not generic SaaS dashboards (purple gradients, hero-metric templates, identical card grids, AI-startup chrome). Not traditional Brazilian campaign kitsch (clipart flags, shouty all-caps, brochure clutter).

## Design Principles

1. **Sovereignty as the horizon** — own audience, data, and ops over time; Big Tech shortcuts (WhatsApp kits, share links) are fine for now when they help mobilization, but design should keep the campaign’s own records and workflows as the source of truth and leave room to reduce platform dependency later.
2. **Clarity under pressure** — every screen earns its keep for field use; prefer plain language and obvious next actions over decoration.
3. **Edit where you see** — on `/campanha` staff surfaces (coordinator / advisor), mutable data that the role can update should be editable in context whenever it fits (list cell, detail card, queue row), so assessors and the general coordinator do not burn time navigating to a separate edit screen for every correction. Prefer named Popovers / selects / short inputs that reuse existing server actions and the same access rules as the full form. Keep dedicated `/editar` (or long Sheets) for multi-field strategy forms, rare fields, and anything that needs a note or confirmation flow. Leadership paths stay read-or-declare as already scoped — never expose staff-only fields. Anti-goals: full-row spreadsheet / data-grid mode; always-mounted inputs on every row; a second generic “editable cell” design system; optimistic _writes of list/aggregate results_ that skip server refresh when the list is the source of truth (optimistic control state is fine — see Feel the action).
4. **Auto-save, no Save button** — editable fields should persist automatically whenever it is safe (on select change, blur, or short debounce — pick what fits the control). Do not require an explicit “Salvar” / Save button for single-field or in-context edits. Pair with Feel the action: optimistic control state + honest pending / saved / error feedback on the field itself. Keep an explicit submit only when the write must be atomic across several fields, needs a note/confirmation, or is a legal consent / irreversible flow. Anti-goals: silent auto-save with no status; saving on every keystroke for free-text without debounce; Save buttons on Popovers and quick-edit cells “just in case.”
5. **Depth and simplicity as peers** — staff workflows can be rich; leadership paths stay light and phone-first without becoming a second-class product.
6. **Intelligence serves organization** — electoral baseline and insights exist to decide where to act, not to impress. The product delivers intelligence, not a fancy spreadsheet: it computes the bulk of the analysis (vigilance across 435 municipalities, structural differential diagnosis, a prioritized decision queue with suggested action menus) so staff spend judgment, not arithmetic. Decision metrics are **relative and local** — coverage of per-municipality goals by auditable pledges, capture of the campo's majoritarian ceiling, quantiles/LQ of the candidate's own distribution — never absolute statewide % (a DF seat costs ~80–150k votes; the statewide record is ~5% of valid votes, so absolute scales flatten into noise). Suggestions are grounded in `docs/research/` (approved discovery, 25 data→decision patterns) and are always a menu for a human: the product never auto-decides, and each decision — including the discarded alternative reading — is recorded ex-ante for the post-election backtest. Anti-goals: raw-count KPIs, 0–100% fixed choropleth scales, "available votes" reservoirs from abstention/null tallies, suggestion-as-rule.
7. **Inspire without kitsch** — socialist and mobilizing in spirit; never shouty campaign brochure aesthetics.
8. **Feel the action** — every user-initiated action (filter, save, URL-driven refresh, opening a heavy sheet) must give **immediate** feedback on the control or surface that was touched — under ~100ms perceived response. Prefer optimistic UI for the _control value_ (select shows the chosen option at once; button shows pending) while the _result_ (list, map, KPIs, detail payload) shows honest pending (`aria-busy`, live region, opacity/skeleton on the region that changes) until the server/RSC catches up. Applies to `/campanha` first (field pressure) and to public interactive flows the same way. Anti-goals: silent waits where the control stays on the old value until navigation finishes; full-page spinner as the only feedback; fake progress bars; omitting accessible busy/live announcements.

## Accessibility & Inclusion

WCAG 2.2 AA as the bar (contrast, keyboard, focus, reduced motion). Plus: larger touch targets for leadership / field phone use, and screen-reader priority on forms (labels, errors, and critical actions must be announced clearly).
