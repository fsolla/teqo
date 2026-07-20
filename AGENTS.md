# Payload CMS Development Rules

You are an expert Payload CMS developer. When working with Payload projects, follow these rules:

## Teqo Project Context (read this first)

Teqo is the digital platform for deputado federal Jorge Solla (PT-BA): public site + editorial CMS + an internal `/campanha` campaign-management area, all in this one Next.js + Payload app. Full architecture/decision doc lives outside this repo at `plano-arquitetura-campanha-2026.md` (Cowork workspace) — check it for the "why" behind decisions below.

**Locked decisions — do not relitigate without a new concrete reason:**

- Single Next.js app, three route groups: `(frontend)` public site, `(payload)` admin, `(campaign)` internal campaign tool. No separate Rust service or frontend app for `/campanha`; it is modeled with Payload collections. The campaign roles are `geral`, `coordenador`, and `lideranca`, all on the separate auth collection `campaignUser` (see "Campaign auth" below).
- Hosting stays on Vercel for now. No self-host/Coolify migration in progress.
- Donations are NOT handled in this app — they run through QueroApoiar (`apoiar.me/jorgesolla`, TSE-homologated). The site only needs a "Doar" link/CTA out to that URL.

**Real conventions already established in this codebase (follow these, not just the generic patterns below):**

- `Contact` is the normalized "person" record (name, email, phone, state/city via `src/lib/cities.ts`, CEP). Don't create a parallel "person" collection for new features (e.g. líderanças/apoiadores) — add a join collection that relates to `Contact`, the same way `Signature` and `Subscription` do.
- Every action that writes to more than one collection (see `src/app/(frontend)/actions/*.ts`) wraps the writes in a Payload transaction (`payload.db.beginTransaction/commitTransaction/rollbackTransaction`) and passes `req: { transactionID }` to every `payload.create`/`payload.update` call. Follow this pattern for any new multi-collection write.
- LGPD consent is tracked via a `Consent` collection (richText, versioned, optional stable `key`) referenced by relationship from `Signature`/`Subscription`/campaign `leadership`. New campaign opt-in flows resolve Consent by stable `key` (e.g. `lideranca-autopreenchimento`) and fail closed when missing — don't invent a parallel consent mechanism or hardcode document IDs for new work.
- Cache invalidation: collections/globals call `revalidateDocumentById` (`src/utilities/documents.ts`) / `revalidateGlobal` (`src/utilities/globals.ts`) in an `afterChange` hook. Add the same hook to any new collection/global that backs a public page. Collections whose listing is cached under a shared tag also call the listing helper (`revalidateCollectionListing`, e.g. `revalidatePostsListing()` → `revalidateTag('posts')`) — see "Posts & Tags" below.
- Admin UI is organized via `admin.group` (e.g. `'Abaixo-assinados'`, `'Contatos'`, `'Configurações'`, `'Paginas'`, `'Campanha'`, `'Dados Eleitorais'`) — group new collections consistently instead of leaving them ungrouped.
- i18n: Payload admin defaults to `pt` (not `pt-BR` — see `payload.config.ts`, `payload/i18n/pt`).
- Language & naming conventions: ALL code identifiers are in English — variable, function, parameter, type/interface names, local constants, and Next.js dynamic route segment folder names used as param keys (e.g. `[type]/[category]/[slug]`, not `[tipo]/[categoria]`). Portuguese is allowed ONLY in: user-visible string literals (JSX text, button/labels), image `alt` text, SEO/metadata values (title/description/keywords), Payload admin config text (`labels`/`singular`/`plural`/`admin.description`/field `label`), and intentional URL slug/enum VALUES kept in Portuguese for SEO (e.g. the `post.type` enum values `noticia|campanha|artigo|evento`, tag/category slugs like `saude`, `eleitoral`). Never translate those data/URL values or admin labels. Renaming a route segment folder changes only the param KEY, never the public URL (segment values come from the data).

**Database & local development (safety-critical — production is a live Neon Postgres with real citizens' PII):**

- Local dev and tests must NEVER touch production. Local dev runs against a local Docker Postgres (`pnpm db:start`); `pnpm dev` refuses a non-local `DATABASE_URL` (guard: `scripts/guard-dev-db.mjs`) unless `ALLOW_REMOTE_DB=true`. Tests load `.env.test` (`teqo_test`) and refuse any database whose name doesn't end in `_test` (`tests/helpers/assertTestDatabase.ts`). Never repoint `.env`/`.env.local`/`.env.test` `DATABASE_URL` at Neon. Full workflow lives in the `local-database` skill (`.cursor/skills/local-database`).
- Schema changes go through committed Payload migrations — `push: false` everywhere, never flip it on against a remote DB. Edit configs → `pnpm migrate:create <name>` → commit `src/migrations/*` (both `.ts` and `.json`, plus `index.ts`) → `pnpm migrate` locally. `pnpm build` runs `payload migrate`, so **every Vercel deploy applies pending migrations to prod**. Prod is baselined at migration `20260715_163458_initial` — never regenerate or replace the initial migration. Full workflow (incl. hand-written data/reconciliation migrations) lives in the `payload-migrations` skill (`.cursor/skills/payload-migrations`).
- `Consent.text` was reconciled from `varchar` to `jsonb` via `20260715_163500_consent_text_to_jsonb` (matching the `richText` field). Any future field-type change is a migration, not a manual DB edit.
- To copy production content locally, use `pnpm db:pull` (`scripts/db-pull.mjs`): it only reads prod, only writes local, and excludes supporter PII (`contact`/`signature`/`subscription` row data).
- To (re)populate news content, `pnpm db:seed:posts` fetches articles live from jorgesolla.com.br into the LOCAL db (same non-local `DATABASE_URL` guard as `pnpm dev`). It writes from a CLI process outside the deployed runtime, so after seeding — or after ANY direct-DB change — you must bust the production `posts` cache via `POST /api/revalidate`. See "Posts & Tags" below.
- To (re)populate the TSE 2022 election baseline, `pnpm db:seed:tse` downloads TSE open data and imports the Bahia scope into the LOCAL db (same guard; no revalidate needed — campaign pages are dynamic). See "Election baseline data (TSE 2022)" below.

## Known Gaps (as of 2026-07-18 — resolve before relying on this file for onboarding new devs)

Backlog consolidado (bloqueadores, site, campanha, white-label): [`docs/roadmap.md`](docs/roadmap.md).

1. **Payload admin RBAC is still absent.** The campaign auth collection now has `role`, but the `users` admin collection still has no roles; every admin user has full Payload admin access. Add admin roles before opening `/admin` to a broader team.
2. **Legacy public consent flows still hardcode document IDs** (e.g. `consent: 2` in `submitWhatsapp.ts`). The campaign leadership flow does not: it requires `Consent.key = 'lideranca-autopreenchimento'` and fails closed when missing. Migrating the older public flows remains separate work.
3. **`Post`/`Tag` ship the news system, but there is still no `Pages` collection for institutional content.** Partly resolved: the `post`/`tag` collections back the news/publications system, and the home "Últimas notícias" list plus the `/[type]`, `/[type]/[category]`, and article routes are live (see "Posts & Tags" below). Still hardcoded/pending: the home hero heading + subtitle copy (`HomePage` global still exposes only a single `image` field — the text lives in `src/app/(frontend)/(home)/page.tsx`), and there is no `Pages` collection yet for institutional content such as the bio and propostas.
4. **Campaign LGPD consent texts are not yet configured in production.** Invites and self-service leadership flows fail closed until an admin creates `Consent.key = 'lideranca-autopreenchimento'` with counsel-approved copy. The C2 supporter registry (merged to `main`, production-blocked) additionally requires `Consent.key = 'apoiador-cadastro'` and `Consent.key = 'apoiador-intencao-voto'` (vote intention is sensitive data) — same fail-closed behavior. All four keys are bundled in the single legal batch of Onda 0 (see deploy checklist).

**Recently resolved (2026-07-18):** the `/campanha` nuclei MVP shipped (auth/RBAC, nuclei, leaderships, vote estimates, updates, WhatsApp invites, dashboard) with consolidated migration `20260718_010733_consolidate_campaign_schema`. Later the same day, cycle 2 was merged and deployed: multi-municipality/neighborhood territory arrays (migration `20260718_190559_territorio_multi_municipio_bairro`), TSE 2022 election baseline collections + `pnpm db:seed:tse` (migration `20260718_195854_add_election_results`), the filtered nuclei-list overview panel, the nucleus share dialog, and the installable `/campanha` PWA. Still on 2026-07-18, **A2** shipped: static Bahia municipality↔TSE zone map (`src/lib/bahiaTseZones.ts` from TSE 2024 `detalhe_votacao_munzona` BA) plus opt-in territory/zone suggestion chips in the nucleus form (`territorySuggestions`, `NucleusTerritoryAndZonesFields`) — no migration, no forced equality on save. Also the same day: **C2** Cadastro nominal de apoiadores (`supporter` join `Contact`↔campanha with optional `nucleus`, migration `20260718_222656_add_supporter` with `UNIQUE NULLS NOT DISTINCT (contact_id, nucleus_id)`, consent keys `apoiador-cadastro` / `apoiador-intencao-voto` resolved via a generalized `campaignConsent.ts` that fails closed, `/campanha/apoiadores` vertical with list+KPIs/detail/CSV-import wizard; phone required in v1, `lideranca` has no access to the area; production use with real data still waits on Consent keys + legal sign-off). Also the same day: C3 Planos de Ação (`actionPlan` + `/campanha/planos`, migration `20260718_222832_add_action_plan`, blocos "Próximos eventos"). Also the same day: **B2** map foundation — static TopoJSON for Bahia municipalities + identity territories, `bahiaMunicipalityCodes`, helpers in `bahiaGeometries`, re-runnable `pnpm build:geometries` (no migration, no UI; Leaflet is B3). Post-`/simplify` scale follow-ups for that delivery are registered as **B5** (`docs/plans/escala-dry-pos-b2.md`). Earlier (2026-07-15): local Postgres via `docker-compose.yml` (Postgres 17, `teqo_test`); Payload migrations baselined; dev/test database guards; `post`/`tag` news routes deployed (see "Posts & Tags" below).

**Recently resolved (2026-07-18 evening / 2026-07-19):** **A4** Baseline no produto + Gap vs 2022 shipped and merged to `main` — `getNucleusElectoralBaseline` / `loadNucleusBaseline2022Overview` aggregate TSE 2022 by nucleus geography; `computeGapVs2022` + `NucleusInsights` on the overview tab; `NucleusElectoralBaseline` card (candidate / president / governor via `BASELINE_TICKET_2022`); "Baseline 2022" card on the filtered nuclei-list overview. No migration (reads existing A3 collections). A `/simplify` pass applied targeted cleanup (role-generic ticket config, per-city `zoneNumber in […]`, shared geography helpers). Scale/DRY debits larger than cleanup (aggregate federal ranking on detail instead of loading all nominal rows, filter by TSE `cityCode`, Alert `confirmed` + `Progress` reuse) are registered as **A7** (`docs/plans/escala-dry-pos-a4.md`).

**Recently resolved (2026-07-19):** **C6** Escala e DRY pós-C2 shipped and merged to `main` — bulk supporter import via `payload.db.drizzle` inside the existing Payload transaction (`supporterImportBulk.ts`, `ON CONFLICT DO NOTHING` on `(contact_id, nucleus_id)`, 500-row chunks), `skipContactPhoneInvariant` opt-in on `Contact.enforceUniqueContactPhone` (fail-closed: only honored inside an active `req.transactionID`), single-SQL KPI aggregate (`supporterListOverviewAggregate.ts`, `COUNT(*) FILTER` mirroring `buildSupporterListWhere` + access constraint), HMAC-SHA256 single-use import token + ephemeral `supporterImportBatch` staging collection (migration `20260719_011015_add_supporter_import_batch`, TTL 10 min, actor-bound, consumed on confirm), and shared shells (`campaignListUrl.ts`, `CampaignListPagination`, `campaignFormFields.ts`, `mapCampaignFormActionError.ts`) replacing the three per-list pagination components. A `/simplify` pass applied targeted cleanup (identity maps, dead branches, `relationshipId`/`canManageCampaignUsers` reuse, native `base64url`, `rowCount ?? 0` bug fix). Scale/DRY debits the simplify reviewers flagged as larger than cleanup (locks in 1 round-trip, `.returning()`, `pg_trgm`, shared `drizzleBulk.ts`, column-name assertion, migrating the remaining `formActions`) are registered as **C8** (`docs/plans/escala-dry-pos-c6.md`). Production use with real supporter data still waits on the Onda 0 legal batch (Consent keys `apoiador-cadastro` / `apoiador-intencao-voto`).

## Posts & Tags (news / publications)

The public news/publications system is backed by two collections (both in the `Publicações` admin group) plus the helpers in `src/utilities/posts.ts`.

- **`post`** (`src/collections/Post.ts`) — fields: `title`, `slug` (unique, indexed, auto-slugified from `title` when left empty), `type` (select enum `noticia|campanha|artigo|evento`), `category` (required single relationship → `tag`), `tags` (`hasMany` relationship → `tag`), `subtitle`, `coverImage` (upload → `media`), `publishedDate`, `body` (richText). Has drafts/versions (`schedulePublish`, `maxPerDoc: 5`).
- **`tag`** (`src/collections/Tag.ts`) — fields: `name`, `slug` (unique, indexed, auto-slugified from `name`), and `hidden` (checkbox, admin label "Esconder", default `false`). Tags are the shared taxonomy for both `post.category` and `post.tags`.

**Tags are a taxonomy, not a person record.** The `Contact` convention above applies to _people_; `tag` is publication metadata (categories + a visibility control flag), so post/tag relations do not touch `Contact`. Don't fold taxonomy into `Contact` or vice-versa.

**Electoral visibility control (`hidden` + fail-closed `isPostVisible`).** Marking a tag `hidden` hides every post that references it — as `category` or in `tags` — with a single toggle. This exists so campaign / pre-candidacy content (tagged `eleitoral`) can be pulled from the public site during the electoral period. `isPostVisible(post)` (`src/utilities/posts.ts`) returns true only when the post is `published` AND none of its related tags (`category` + `tags`) is `hidden`. It **fails closed**: an unpopulated relation (a bare numeric id) is treated as hiding, so callers must fetch with `depth >= 1`. Every public read filters through `getVisiblePosts()`, which applies this predicate to the cached published list.

**URLs and Portuguese SEO values.** The canonical article path is `/[type]/[category]/[slug]` (e.g. `/noticia/saude/<slug>`), with `/[type]` and `/[type]/[category]` listing routes and the home "Últimas notícias" list. The `type` enum values (`noticia|campanha|artigo|evento`) and tag/category slugs (`saude`, `eleitoral`, …) are deliberately Portuguese for SEO and are **data, not identifiers** — never translate them (see the naming-conventions bullet above). The route folders are `[type]/[category]/[slug]` (English param keys); the article route redirects any stale/mismatched URL to the canonical path derived from the post's _current_ `type` + category slug. Article pages emit JSON-LD (`Article`) and Open Graph metadata.

**Caching (mixed ISR, `posts` tag).** Public reads go through the `unstable_cache` wrappers in `src/utilities/posts.ts` (`getCachedPublishedPosts`, `getCachedPostBySlug`), all tagged `posts`. The routes set `export const dynamicParams = true` and build `generateStaticParams` from `getVisiblePosts()`: known paths are statically generated, unknown ones render on demand, and everything stays cached until the `posts` tag is busted. `revalidatePostsListing()` (`src/utilities/documents.ts`) is `revalidateTag('posts')` (the listing tag is `` `${collection}s` `` → `posts`), so one call busts the home page, every listing route, and every article route at once.

**Self-revalidation on admin edits.** Both collections have an `afterChange` hook. `post` busts its own document tag + the `posts` listing on every publish/update (skipping only the initial draft that the admin create view generates during render). `tag` is broader: on change it re-reads every post referencing that tag (as `category` or in `tags`, passing `req` for transaction safety) and revalidates each one plus the listing — so flipping `hidden` is reflected on the site immediately.

**Seeding news content (`pnpm db:seed:posts`).** `scripts/seed-posts.mjs` (loaded via `scripts/seed-loader.mjs`) fetches ~39 articles live from jorgesolla.com.br (WordPress REST API, with an HTML-crawl fallback), imports them as `type: 'noticia'` published posts, converts the WP HTML body to Payload Lexical, and uploads cover images to Vercel Blob. The taxonomy (categories + the `eleitoral` control tag, and the per-slug classification) is hardcoded in the script; it reads/writes the `hidden` flag. It is **idempotent by slug** (existing posts are skipped; tags/media are reused by slug/filename) and reuses the same non-local `DATABASE_URL` guard as `pnpm dev` (override only with `ALLOW_REMOTE_DB=true`). The Vercel Blob store is shared across environments, so before uploading a cover it deletes any orphan blob left under the same deterministic `<slug>.<ext>` key, keeping the seed re-runnable.

### Revalidating after a manual/direct DB change

Admin edits made through the deployed app self-revalidate via the `afterChange` hooks above. But any write that does **not** go through the deployed Payload runtime — direct SQL, `pnpm db:seed:posts`, a DB restore / `db:pull` — will **not** bust production's frozen `posts` cache. (Even when such a write triggers the hook, its `revalidateTag('posts')` runs in that CLI/local process and cannot touch the deployed server's cache.) The pages keep serving stale content until the tag is busted.

Bust it with the secured endpoint (`src/app/(frontend)/api/revalidate/route.ts`):

```bash
# News (`posts` tag — default)
curl -X POST "https://<prod-domain>/api/revalidate" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Privacy policy global after Onda 0 migration/seed (`global_privacy-policy`)
curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

- **Auth:** send the secret via `x-revalidate-secret` or `Authorization: Bearer <secret>`; it is compared to `REVALIDATE_SECRET` with a constant-time check.
- `REVALIDATE_SECRET` must be set in the Vercel **production** env (and in your local env if you want to test the endpoint). It is documented in `.env.example`.
- **Tag:** optional `?tag=` query or JSON body `{ "tag": "..." }` (query wins). Allowlist: `posts` (default), `global_privacy-policy`. Unknown tag → `400`.
- **Responses:** `200 { revalidated: true, tag: '...' }` on success; `401` if the secret is missing/wrong; `500` if `REVALIDATE_SECRET` is not configured on the server.
- This POST is the required last step of the post-seed / direct-DB-change runbook.

## Campaign auth (`/campanha`)

The internal `/campanha` area is gated by its own authentication, deliberately kept **isolated from the Payload admin (`/admin`)** so a campaign session and an admin session can coexist in the same browser.

- **`campaignUser` collection** (`src/collections/CampaignUser.ts`) — a separate Payload auth collection with `name`, optional contact `phone`, and required `role`: `geral`, `coordenador`, or `lideranca` (default and least privilege). Staff may sign in by email; leadership accounts use the normalized 11-digit phone as `username`. It is not `users`: `admin.user` remains `users`, so campaign users cannot log into `/admin`.
- **Isolated session cookie `campaign-token`.** The flow sets its own httpOnly cookie named `campaign-token` (constant `CAMPAIGN_TOKEN_COOKIE` in `src/utilities/campaignAuth.ts`), scoped to `path: '/campanha'`, `sameSite: 'lax'`, and `secure` only in production. It is deliberately NOT the default `payload-token` cookie — using a distinct name + path is what lets a campaign session and a Payload admin session live side by side without clobbering each other.
- **Session verification — `getCampaignUser()`** (`src/utilities/campaignAuth.ts`). Reads the `campaign-token` cookie, calls `payload.auth({ headers })`, accepts only `user.collection === 'campaignUser'`, then reloads that document by ID. The fresh read makes role downgrades effective immediately instead of trusting a stale JWT role.
- **Login/logout server actions** (`src/app/(campaign)/campanha/actions/auth.ts`). `loginCampaign` validates input with `campaignLoginSchema` (`src/lib/schemas/campaign-login.ts`), calls `payload.login({ collection: 'campaignUser' })`, and — because the Local API returns a token WITHOUT setting a cookie — sets the `campaign-token` cookie itself (using the collection's `auth.tokenExpiration` as `maxAge`) before redirecting to `/campanha`. `logoutCampaign` clears the cookie (`maxAge: 0`) and redirects to `/campanha/login`.
- **Route layout.** The route group's root layout `src/app/(campaign)/layout.tsx` renders the `<html>`/`<body>` with `data-theme="campaign"`. The public login lives at `src/app/(campaign)/campanha/login/` (`page.tsx` + client `LoginForm.tsx`). Everything gated sits in the `(app)` group, whose layout (`src/app/(campaign)/campanha/(app)/layout.tsx`) calls `getCampaignUser()` and `redirect('/campanha/login')` when there is no session — that layout is the barrier.
- **Migrations.** `20260716_010420_add_campaign_user` created the auth collection; the unpublished 2026-07-17 campaign chain was consolidated into `20260718_010733_consolidate_campaign_schema`, which adds role/username auth, contact phone, and the remaining final campaign schema.

## Campaign nuclei MVP

The first `/campanha` operational cycle is centered on `electoralNucleus`; a Núcleo is the campaign's operating unit and is not a TSE electoral zone.

- **Collections:** `electoralNucleus` (territory, coordinators, TSE zone references, intelligence and vote estimates), `leadership` (unique `Contact`↔nucleus join with support status), `nucleusUpdate` (immutable field reports), and `campaignInvite` (single-use WhatsApp invite hashes). All are in admin group `Campanha`.
- **Canonical nucleus URLs:** nuclei use a unique canonical `slug` generated from `name` and route through `/campanha/nucleos/[slug]`. IDs stay internal. Names are immutable after creation so existing shared links remain durable without an alias table.
- **Territory:** Bahia is implicit. Since 2026-07-18 nuclei use `hasMany` arrays `regions` / `cities` / `neighborhoods` (plus `locality` / `territoryNotes`), validated against official Bahia identity territories (`src/lib/bahiaTerritories.ts`): `regions` is derived server-side from the selected cities, and neighborhoods require exactly one city. List filters stay single-select and query array membership with `{ equals }`. Migration `20260718_190559_territorio_multi_municipio_bairro` backfilled the old scalar fields (`docs/plans/territorio-multi-municipio-bairro.md`). **A2 (2026-07-18):** static municipality↔TSE zone map in `src/lib/bahiaTseZones.ts` (`tseZonesForCity` / `tseZonesForTerritory` / `citiesForTseZone`); the create/edit form coordinator `NucleusTerritoryAndZonesFields` offers opt-in `{label} +` chips from `buildTerritorySuggestions` (city/TI → missing zones; TI siblings and zone cities → municipalities). Manual `TseZoneInput` stays free (1–999); server validation does not require `tseZones` to match the official set; an amber client advisory may warn when a typed zone is outside the selected geography. Details: `docs/plans/zonas-por-municipio.md`. **B2 (2026-07-18):** static map geometries — see "Campaign map geometries (B2)" below (Leaflet surfaces are B3).
- **Role scope:** `geral` sees/manages all nuclei, assigns coordinators, and confirms estimates; `coordenador` sees assigned nuclei and manages their leaderships, updates, invites, and estimates; `lideranca` sees only nuclei linked through an engaged leadership record, creates own updates, and suggests estimates.
- **Sensitive fields:** `leadership.supportStatus`, internal notes, consent notes, and strategic nucleus intelligence are staff-only and are excluded from leadership view models. Revoking `engajado` revokes nucleus access immediately. Dashboard aggregates omit Payload-redacted missing statuses and fail closed on invalid enum values.
- **People and consent:** leaderships always reuse `Contact`; multi-collection writes are transactional. Self-service updates accept a strict whitelist derived from the invite token. Campaign consent is looked up only by the stable key `lideranca-autopreenchimento`.
- **Invites:** only SHA-256 token hashes are persisted. Absolute invite URLs require a valid `NEXT_PUBLIC_SITE_URL` (exact HTTPS DNS origin in production). Public invite pages are dynamic, `no-store`, `noindex,nofollow`, `no-referrer`, and have no third-party application scripts. Login invites are allowed only for engaged leaderships.
- **Vote estimates:** proposals never overwrite the confirmed value; each proposal carries a server-generated UUID version compared under advisory lock on confirm. Only a coordinator assigned to the nucleus or `geral` may confirm.
- **List overview (B1, 2026-07-18):** `/campanha/nucleos` renders an aggregate panel between the filters and the list (`NucleusListOverview` + `loadNucleusListOverviewData`): confirmed vote estimate total/%, coordinator coverage, and a 3-update preview, computed over the entire filtered set (`buildNucleusListWhere`, `pagination: false`, `overrideAccess: false`). Hidden when the filtered set is empty; `lideranca` gets a reduced select without pending-suggestion counts.
- **Share dialog (C1, 2026-07-18):** the nucleus detail header has a "Compartilhar" dialog (WhatsApp `wa.me` per recipient + copy link) that sends only the URL — it never creates invites or grants access. Recipients (gerais, assigned coordinators, `engajado` leaderships) are loaded on open via a read-only Server Action; the loader gates on nucleus access (`overrideAccess: false`) then reads name+phone privileged (`overrideAccess: true`) to avoid N+1 field-access checks. `canReadCampaignUserPhone` allows any campaign user to read `geral` phones.
- **PWA (D1, 2026-07-18):** `/campanha` is installable — manifest and service worker are served by route handlers under `/campanha` (script built in `src/utilities/campaignPwa.ts`), scoped to the vertical only (public site and `/admin` have no SW). Cache is named `campanha-<buildId>` and swapped on deploy (`skipWaiting`/`claim`); navigation is network-first with an `/campanha/offline` fallback; RSC/Flight responses and `/campanha/convite/*` are never cached. `InstallPwaToast` prompts install on mobile (Android `beforeinstallprompt`, iOS step-by-step drawer, `sessionStorage` dismissal), and logout wipes the Cache API client-side before the server action runs. Push handlers are placeholders for D2.

## Campaign supporters (C2)

Nominal supporter registry backing the campaign's base of declared supporters (roadmap item C2; engineering ready and merged to `main` on 2026-07-18, production-blocked on the legal batch). One collection in admin group `Campanha`:

- **`supporter`** (`src/collections/Supporter.ts`) — join `Contact`↔campaign with **optional `nucleus`** (transversal base; aggregates by territory when linked). Fields: `contact` (required, indexed), `nucleus` (optional, indexed), `voteIntention` (select `certo | tende_a_certo | indeciso | outro`, indexed — **sensitive data**, field access restricted to `geral`/`coordenador`), paired consent fields for registration and vote intention (`consent`/`consentContentHash`/`consentedAt` and `voteIntentionConsent`/`voteIntentionConsentContentHash`/`voteIntentionConsentedAt`), `source` (`import_csv | manual | convite | evento`; v1 writes only the first two), `consentNote`, `notes` (staff-only), `createdBy` (readOnly). Uniqueness: `UNIQUE NULLS NOT DISTINCT (contact_id, nucleus_id)` (Postgres ≥15) via migration `20260718_222656_add_supporter`. A `beforeChange` hook sets `createdBy` and rejects a `contact` that is already a `leadership` of the same `nucleus`.
- **Consent by stable key.** `campaignConsent.ts` was generalized to `getConsentByKey` / `requireConsentByKey` (fail-closed). The two keys are `apoiador-cadastro` (declared support) and `apoiador-intencao-voto` (vote intention — highlighted, separate consent). The app fails closed if either key is missing — same pattern as `lideranca-autopreenchimento`.
- **Access.** `geral` sees/manages all; `coordenador` sees supporters of assigned nuclei (`nucleus in getAccessibleNucleusIds`); supporters without a nucleus are `geral`-only; `lideranca` has no access to the area. Delete is admin-only. Access helpers live in `campaignAccess.ts` (`canReadSupporter` / `canManageSupporter` / `canCreateSupporter`).
- **Server actions** (`src/app/(campaign)/campanha/actions/supporter.ts`): `createSupporter`, `setSupporterVoteIntention`, `previewSupporterImport` / `confirmSupporterImport` (CSV, `geral`-only, transactional with `req: { transactionID }`, dedup by phone via `contactPhoneInvariant`), and `removeSupporterData` (deletes the `supporter`; anonymizes/clears `Contact` PII only if no other join — `leadership`/`signature`/`subscription`/other `supporter` — references it).
- **UI** `/campanha/apoiadores` — list with KPIs (total / "Certo + Tende" / "Indecisos"), filters (vote intention, territory), detail with LGPD consent block + vote-intention segmented control (disabled until consent) + minimal share kit (`wa.me` + copy text), and a 3-step CSV import wizard (Upload → Preview → Confirm). Phone is required in v1.
- **C6 scale layer (merged to `main` 2026-07-19).** CSV import up to 5000 rows now completes in one transaction: `confirmSupporterImportRecord` acquires all phone advisory locks, then `bulkInsertSupporterImport` (`src/utilities/supporterImportBulk.ts`) inserts contacts + supporters via `payload.db.drizzle` on the Payload transaction session (`getPostgresTransactionDatabase`) in 500-row chunks with `ON CONFLICT DO NOTHING` on `(contact_id, nucleus_id)`. `Contact.enforceUniqueContactPhone` honors `context.skipContactPhoneInvariant` **fail-closed** (only inside an active `req.transactionID`), so the bulk path skips the per-row re-check while the single-create path is unchanged. Preview no longer round-trips the full `ok` set: `previewSupporterImportText` stages it in `supporterImportBatch` (`src/collections/SupporterImportBatch.ts`, admin-hidden, `geral`/admin only, migration `20260719_011015_add_supporter_import_batch`) and returns an HMAC-SHA256 single-use `importToken` (10-min TTL, actor-bound, `src/utilities/supporterImportToken.ts`); `confirmSupporterImportRecord` verifies the token and consumes the batch (delete after commit). The list KPI is a single `COUNT(*) FILTER` aggregate (`src/utilities/supporterListOverviewAggregate.ts`) mirroring `buildSupporterListWhere` + the access constraint, replacing 3× `payload.count`. Shared shells — `campaignListUrl.ts`, `CampaignListPagination`, `campaignFormFields.ts`, `mapCampaignFormActionError.ts` — replace the three per-list pagination components and the duplicated form-error ladders. Scale/DRY follow-ups from the `/simplify` pass are registered as **C8** (`docs/plans/escala-dry-pos-c6.md`).
- **Mandatory production blocker:** do not import real supporter data or capture vote intention until electoral counsel documents the LGPD art. 11 basis (vote intention is sensitive data), approves the versioned consent texts, and an admin creates `Consent.key = 'apoiador-cadastro'` and `Consent.key = 'apoiador-intencao-voto'`. The app intentionally fails closed when these keys are absent.

## Campaign action plans (C3)

Mobilization events / agenda backing the campaign's field operations (roadmap item C3; implemented and merged to `main` on 2026-07-18). One collection in admin group `Campanha`:

- **`actionPlan`** (`src/collections/ActionPlan.ts`) — a calendarizable action/event (caminhada, comício, etc.) with its own territory (no link to `electoralNucleus`), task checklist, and update feed. Fields: `title`, canonical immutable `slug` (from `title`), `kind` / `status` enums in pt-BR (data values), `startAt` (optional only while `rascunho`; required to move to `planejado`/`confirmado`/`realizado`/`cancelado` — card shows "Data a definir" when absent), territory arrays `regions`/`cities`/`neighborhoods` (Bahia validation shared via `campaignTerritoryValidation.ts`; list/overview filters use `{ equals }` on arrays, A1 semantics), people (`coordinators` → `campaignUser`, `responsible` → `Contact`, `leadership` → `leadership` optional), `tasks` and `updates` as arrays in the MVP (append-only for updates; `doneAt`/`author`/`createdAt` derived server-side). No `Consent` (internal staff data). Migration `20260718_222832_add_action_plan`.
- **Access.** `geral` everything; `coordenador` where listed in `coordinators` (may create, auto-included); `lideranca` where `leadership` ∈ engaged — write limited to toggling `tasks.done` and appending `updates`. Domain writes go through `withPayloadTransaction` (`src/utilities/payloadTransaction.ts`).
- **UI** `/campanha/planos` — list with tabs Próximos (default) / Todos / Realizados / Rascunhos, filters (kind, territory), cards with kind/status badge + date/time + municipality + TI chip + "Resp:" + task progress; detail with tabs Visão geral / Tarefas / Atualizações (pattern `NucleusTabNav`); new/edit forms. "Próximos eventos" blocks surface on the nuclei list overview and the dashboard.

## Campaign map geometries (B2)

Static Bahia map foundation for future Leaflet surfaces (roadmap B2; UI is B3). No migration, collection, Consent, or server action — same static-data pattern as `bahiaTerritories` / `bahiaTseZones`.

- **Artifacts (committed):** `src/lib/geometries/bahia-municipalities.topo.json` (~132 KB; Topology object `municipalities`, 417 features, `properties: { codarea, name }`) and `src/lib/geometries/bahia-identity-territories.topo.json` (~15 KB; object `territories`, 27 features, `properties: { code, name }`). Soft size budget in tests: ≤ ~600 KB each.
- **Code table:** `src/lib/bahiaMunicipalityCodes.ts` — canonical municipality name → IBGE 7-digit `codarea`, plus `codeForMunicipality` / `municipalityForCode`. Fixture `tests/fixtures/bahia-municipality-codes.official.json` + int tests for bijection/coverage.
- **Runtime helpers:** `src/lib/bahiaGeometries.ts` — `getMunicipalityFeature` / `getTerritoryFeature`, typed topologies, feature arrays. Eagerly decodes TopoJSON→GeoJSON at module load (lazy split is B5 F1 — prefer with B3).
- **Territory polygons:** dissolved from IBGE municipality meshes via `bahiaIdentityTerritoryRecords` (`topojson` `merge`), not the IDE Bahia shapefile (IDE remains provenance/validation reference only).
- **Rebuild:** `pnpm build:geometries` (`scripts/build-bahia-geometries.mjs`) downloads IBGE Malhas (qualidade intermediaria) + Localidades, reconciles names with `canonicalizeMunicipalityName`, simplifies/quantizes, emits the artifacts above. Cache under `data/geometries/` (gitignored; override with `GEOMETRIES_CACHE_DIR`). **Does not touch the database** — no `assertLocalDatabase` / no Neon risk. Not part of `pnpm build` or `pnpm dev`. Details: `docs/plans/mapa-bahia-geometrias.md`. Scale/DRY follow-ups from `/simplify`: `docs/plans/escala-dry-pos-b2.md` (B5).

## Election baseline data (TSE 2022)

Public TSE 2022 results back the electoral baseline (roadmap items A3 + A4). Three collections in admin group `Dados Eleitorais`: `electionTally` (per city×zone totals: eligible voters, turnout, valid/blank/null votes), `electionCandidateVote` (nominal votes per candidate×city×zone), and `electionCandidate` (candidate registry with a cross-year `identityKey` hash — no CPF or voter ID is ever persisted). Read access requires an authenticated `campaignUser` or `users` account (`canReadElectionData`); writes are Payload-admin-only, and the import runs via CLI with `overrideAccess: true`. **A4 (merged to `main` 2026-07-18):** `getNucleusElectoralBaseline` / `loadNucleusBaseline2022Overview` / `computeGapVs2022` surface the baseline on the nucleus overview tab (`NucleusElectoralBaseline` + `NucleusInsights` Gap vs 2022) and a "Baseline 2022" card on the filtered nuclei list overview; ticket roles live in `BASELINE_TICKET_2022`. Scale follow-ups from the A4 `/simplify` pass are **A7** (`docs/plans/escala-dry-pos-a4.md`).

`pnpm db:seed:tse` (`scripts/seed-tse-results.mjs`) downloads the TSE open-data zips (provenance URLs + SHA-256 in the script header), parses the Bahia scope, and imports via `payload.db.drizzle` in a transaction — idempotent by replace-per-scope `(year, office, turn)`, only `voteType: 'nominal'` rows in v1. It refuses a non-local `DATABASE_URL` (same guard family as the other seeds; override with `ALLOW_REMOTE_DB=true`) and caches downloads under `data/tse/` (gitignored). No revalidate step is needed: campaign pages are dynamic with auth, not ISR-cached.

### Local verification and deploy checklist

1. Confirm `DATABASE_URL` is `postgresql://teqo:teqo@localhost:5432/teqo` and `.env.test` points to `teqo_test`; never use Neon for development, tests, E2E, or local builds.
2. Run `pnpm db:start`, `pnpm migrate:status`, and `DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate:status`; every migration must show `Ran: Yes`.
3. Run `pnpm generate:types`, `pnpm generate:importmap` when components changed, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (unit + int), `pnpm test:e2e` (or `pnpm test:all`), and `pnpm build` against the local database. Payload CLI scripts (`migrate`, `generate:*`, `payload`) and the build migrate step use `--conditions=react-server` so `server-only` modules load correctly outside Next.js.
4. Scan every edited runtime source file with Aikido and resolve new findings before handoff. Do not expand hardening work into unrelated pre-existing findings without an explicit scope change.
5. Review Vercel environment variables and migration SQL before deploy; `pnpm build` applies pending migrations to production automatically.
6. **Mandatory production blocker:** do not insert real leadership/support data or enable invites until electoral counsel documents the LGPD art. 11 basis, approves the specific versioned consent text, and an admin creates it with exactly `Consent.key = 'lideranca-autopreenchimento'`. The app intentionally fails closed when this key is absent.

## Core Principles

1. **TypeScript-First**: Always use TypeScript with proper types from Payload
2. **Security-Critical**: Follow all security patterns, especially access control
3. **Type Generation**: Run `generate:types` script after schema changes
4. **Transaction Safety**: Always pass `req` to nested operations in hooks
5. **Access Control**: Understand Local API bypasses access control by default
6. **Access Control**: Ensure roles exist when modifiyng collection or globals with access controls

### Code Validation

- To validate typescript correctness after modifying code run `tsc --noEmit`
- Generate import maps after creating or modifying components.
- Any change to a collection/global/field schema requires a migration: `pnpm migrate:create <name>`, then `pnpm migrate` locally. Never rely on `push` (it is `false`). See the `payload-migrations` skill.

## Project Structure

Generic Payload layout (aspirational — `access/` and `hooks/` as separate dirs don't exist yet in this repo; access control and hooks are currently written inline inside each collection/global file):

```
src/
├── app/
│   ├── (frontend)/          # Frontend routes + server actions (src/app/(frontend)/actions/*.ts)
│   ├── (payload)/           # Payload admin routes
│   └── (campaign)/          # Internal campaign-management area (auth barrier, see "Campaign auth")
├── collections/             # Users, CampaignUser, CampaignInvite, ElectoralNucleus, Leadership, NucleusUpdate, Supporter, SupporterImportBatch, ActionPlan, ElectionTally, ElectionCandidateVote, ElectionCandidate, Media, Petition, Signature, Consent, Contact, Subscription, Post, Tag
├── globals/                 # Global configs (SiteSettings, HomePage, Metadata)
├── components/              # Custom React components (campaign/*, ui from shadcn)
├── lib/                     # cities.ts, bahiaTerritories.ts, bahiaTseZones.ts, bahiaMunicipalityCodes.ts, bahiaGeometries.ts, geometries/*.topo.json, territorySuggestions.ts, formData.ts, zod schemas (lib/schemas/*)
├── utilities/               # campaign*, nucleus*, posts, documents, globals, locks, etc.
└── payload.config.ts        # Main config
```

## Configuration

### Minimal Config Pattern

```typescript
import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL,
  }),
})
```

## Collections

### Basic Collection

```typescript
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
  ],
  timestamps: true,
}
```

### Auth Collection with RBAC

```typescript
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: ['admin', 'editor', 'user'],
      defaultValue: ['user'],
      required: true,
      saveToJWT: true, // Include in JWT for fast access checks
      access: {
        update: ({ req: { user } }) => user?.roles?.includes('admin'),
      },
    },
  ],
}
```

## Fields

### Common Patterns

```typescript
// Auto-generate slugs
import { slugField } from 'payload'
slugField({ fieldToUse: 'title' })

// Relationship with filtering
{
  name: 'category',
  type: 'relationship',
  relationTo: 'categories',
  filterOptions: { active: { equals: true } },
}

// Conditional field
{
  name: 'featuredImage',
  type: 'upload',
  relationTo: 'media',
  admin: {
    condition: (data) => data.featured === true,
  },
}

// Virtual field
{
  name: 'fullName',
  type: 'text',
  virtual: true,
  hooks: {
    afterRead: [({ siblingData }) => `${siblingData.firstName} ${siblingData.lastName}`],
  },
}
```

## CRITICAL SECURITY PATTERNS

### 1. Local API Access Control (MOST IMPORTANT)

```typescript
// ❌ SECURITY BUG: Access control bypassed
await payload.find({
  collection: 'posts',
  user: someUser, // Ignored! Operation runs with ADMIN privileges
})

// ✅ SECURE: Enforces user permissions
await payload.find({
  collection: 'posts',
  user: someUser,
  overrideAccess: false, // REQUIRED
})

// ✅ Administrative operation (intentional bypass)
await payload.find({
  collection: 'posts',
  // No user, overrideAccess defaults to true
})
```

**Rule**: When passing `user` to Local API, ALWAYS set `overrideAccess: false`

### 2. Transaction Safety in Hooks

```typescript
// ❌ DATA CORRUPTION RISK: Separate transaction
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.create({
        collection: 'audit-log',
        data: { docId: doc.id },
        // Missing req - runs in separate transaction!
      })
    },
  ],
}

// ✅ ATOMIC: Same transaction
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.create({
        collection: 'audit-log',
        data: { docId: doc.id },
        req, // Maintains atomicity
      })
    },
  ],
}
```

**Rule**: ALWAYS pass `req` to nested operations in hooks

### 3. Prevent Infinite Hook Loops

```typescript
// ❌ INFINITE LOOP
hooks: {
  afterChange: [
    async ({ doc, req }) => {
      await req.payload.update({
        collection: 'posts',
        id: doc.id,
        data: { views: doc.views + 1 },
        req,
      }) // Triggers afterChange again!
    },
  ],
}

// ✅ SAFE: Use context flag
hooks: {
  afterChange: [
    async ({ doc, req, context }) => {
      if (context.skipHooks) return

      await req.payload.update({
        collection: 'posts',
        id: doc.id,
        data: { views: doc.views + 1 },
        context: { skipHooks: true },
        req,
      })
    },
  ],
}
```

## Access Control

### Collection-Level Access

```typescript
import type { Access } from 'payload'

// Boolean return
const authenticated: Access = ({ req: { user } }) => Boolean(user)

// Query constraint (row-level security)
const ownPostsOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user?.roles?.includes('admin')) return true

  return {
    author: { equals: user.id },
  }
}

// Async access check
const projectMemberAccess: Access = async ({ req, id }) => {
  const { user, payload } = req

  if (!user) return false
  if (user.roles?.includes('admin')) return true

  const project = await payload.findByID({
    collection: 'projects',
    id: id as string,
    depth: 0,
  })

  return project.members?.includes(user.id)
}
```

### Field-Level Access

```typescript
// Field access ONLY returns boolean (no query constraints)
{
  name: 'salary',
  type: 'number',
  access: {
    read: ({ req: { user }, doc }) => {
      // Self can read own salary
      if (user?.id === doc?.id) return true
      // Admin can read all
      return user?.roles?.includes('admin')
    },
    update: ({ req: { user } }) => {
      // Only admins can update
      return user?.roles?.includes('admin')
    },
  },
}
```

### Common Access Patterns

```typescript
// Anyone
export const anyone: Access = () => true

// Authenticated only
export const authenticated: Access = ({ req: { user } }) => Boolean(user)

// Admin only
export const adminOnly: Access = ({ req: { user } }) => {
  return user?.roles?.includes('admin')
}

// Admin or self
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('admin')) return true
  return { id: { equals: user?.id } }
}

// Published or authenticated
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}
```

## Hooks

### Common Hook Patterns

```typescript
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  hooks: {
    // Before validation - format data
    beforeValidate: [
      async ({ data, operation }) => {
        if (operation === 'create') {
          data.slug = slugify(data.title)
        }
        return data
      },
    ],

    // Before save - business logic
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation === 'update' && data.status === 'published') {
          data.publishedAt = new Date()
        }
        return data
      },
    ],

    // After save - side effects
    afterChange: [
      async ({ doc, req, operation, previousDoc, context }) => {
        // Check context to prevent loops
        if (context.skipNotification) return

        if (operation === 'create') {
          await sendNotification(doc)
        }
        return doc
      },
    ],

    // After read - computed fields
    afterRead: [
      async ({ doc, req }) => {
        doc.viewCount = await getViewCount(doc.id)
        return doc
      },
    ],

    // Before delete - cascading deletes
    beforeDelete: [
      async ({ req, id }) => {
        await req.payload.delete({
          collection: 'comments',
          where: { post: { equals: id } },
          req, // Important for transaction
        })
      },
    ],
  },
}
```

## Queries

### Local API

```typescript
// Find with complex query
const posts = await payload.find({
  collection: 'posts',
  where: {
    and: [{ status: { equals: 'published' } }, { 'author.name': { contains: 'john' } }],
  },
  depth: 2, // Populate relationships
  limit: 10,
  sort: '-createdAt',
  select: {
    title: true,
    author: true,
  },
})

// Find by ID
const post = await payload.findByID({
  collection: 'posts',
  id: '123',
  depth: 2,
})

// Create
const newPost = await payload.create({
  collection: 'posts',
  data: {
    title: 'New Post',
    status: 'draft',
  },
})

// Update
await payload.update({
  collection: 'posts',
  id: '123',
  data: { status: 'published' },
})

// Delete
await payload.delete({
  collection: 'posts',
  id: '123',
})
```

### Query Operators

```typescript
// Equals
{ status: { equals: 'published' } }

// Not equals
{ status: { not_equals: 'draft' } }

// Greater than / less than
{ price: { greater_than: 100 } }
{ age: { less_than_equal: 65 } }

// Contains (case-insensitive)
{ title: { contains: 'payload' } }

// Like (all words present)
{ description: { like: 'cms headless' } }

// In array
{ category: { in: ['tech', 'news'] } }

// Exists
{ image: { exists: true } }

// Near (geospatial)
{ location: { near: [-122.4194, 37.7749, 10000] } }
```

### AND/OR Logic

```typescript
{
  or: [
    { status: { equals: 'published' } },
    { author: { equals: user.id } },
  ],
}

{
  and: [
    { status: { equals: 'published' } },
    { featured: { equals: true } },
  ],
}
```

## Getting Payload Instance

```typescript
// In API routes (Next.js)
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  const payload = await getPayload({ config })

  const posts = await payload.find({
    collection: 'posts',
  })

  return Response.json(posts)
}

// In Server Components
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function Page() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'posts' })

  return <div>{docs.map(post => <h1 key={post.id}>{post.title}</h1>)}</div>
}
```

## Components

The Admin Panel can be extensively customized using React Components. Custom Components can be Server Components (default) or Client Components.

### Defining Components

Components are defined using **file paths** (not direct imports) in your config:

**Component Path Rules:**

- Paths are relative to project root or `config.admin.importMap.baseDir`
- Named exports: use `#ExportName` suffix or `exportName` property
- Default exports: no suffix needed
- File extensions can be omitted

```typescript
import { buildConfig } from 'payload'

export default buildConfig({
  admin: {
    components: {
      // Logo and branding
      graphics: {
        Logo: '/components/Logo',
        Icon: '/components/Icon',
      },

      // Navigation
      Nav: '/components/CustomNav',
      beforeNavLinks: ['/components/CustomNavItem'],
      afterNavLinks: ['/components/NavFooter'],

      // Header
      header: ['/components/AnnouncementBanner'],
      actions: ['/components/ClearCache', '/components/Preview'],

      // Dashboard
      beforeDashboard: ['/components/WelcomeMessage'],
      afterDashboard: ['/components/Analytics'],

      // Auth
      beforeLogin: ['/components/SSOButtons'],
      logout: { Button: '/components/LogoutButton' },

      // Settings
      settingsMenu: ['/components/SettingsMenu'],

      // Views
      views: {
        dashboard: { Component: '/components/CustomDashboard' },
      },
    },
  },
})
```

**Component Path Rules:**

- Paths are relative to project root or `config.admin.importMap.baseDir`
- Named exports: use `#ExportName` suffix or `exportName` property
- Default exports: no suffix needed
- File extensions can be omitted

### Component Types

1. **Root Components** - Global Admin Panel (logo, nav, header)
2. **Collection Components** - Collection-specific (edit view, list view)
3. **Global Components** - Global document views
4. **Field Components** - Custom field UI and cells

### Component Types

1. **Root Components** - Global Admin Panel (logo, nav, header)
2. **Collection Components** - Collection-specific (edit view, list view)
3. **Global Components** - Global document views
4. **Field Components** - Custom field UI and cells

### Server vs Client Components

**All components are Server Components by default** (can use Local API directly):

```tsx
// Server Component (default)
import type { Payload } from 'payload'

async function MyServerComponent({ payload }: { payload: Payload }) {
  const posts = await payload.find({ collection: 'posts' })
  return <div>{posts.totalDocs} posts</div>
}

export default MyServerComponent
```

**Client Components** need the `'use client'` directive:

```tsx
'use client'
import { useState } from 'react'
import { useAuth } from '@payloadcms/ui'

export function MyClientComponent() {
  const [count, setCount] = useState(0)
  const { user } = useAuth()

  return (
    <button onClick={() => setCount(count + 1)}>
      {user?.email}: Clicked {count} times
    </button>
  )
}
```

### Using Hooks (Client Components Only)

```tsx
'use client'
import {
  useAuth, // Current user
  useConfig, // Payload config (client-safe)
  useDocumentInfo, // Document info (id, collection, etc.)
  useField, // Field value and setter
  useForm, // Form state
  useFormFields, // Multiple field values (optimized)
  useLocale, // Current locale
  useTranslation, // i18n translations
  usePayload, // Local API methods
} from '@payloadcms/ui'

export function MyComponent() {
  const { user } = useAuth()
  const { config } = useConfig()
  const { id, collection } = useDocumentInfo()
  const locale = useLocale()
  const { t } = useTranslation()

  return <div>Hello {user?.email}</div>
}
```

### Collection/Global Components

```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    components: {
      // Edit view
      edit: {
        PreviewButton: '/components/PostPreview',
        SaveButton: '/components/CustomSave',
        SaveDraftButton: '/components/SaveDraft',
        PublishButton: '/components/Publish',
      },

      // List view
      list: {
        Header: '/components/ListHeader',
        beforeList: ['/components/BulkActions'],
        afterList: ['/components/ListFooter'],
      },
    },
  },
}
```

### Field Components

```typescript
{
  name: 'status',
  type: 'select',
  options: ['draft', 'published'],
  admin: {
    components: {
      // Edit view field
      Field: '/components/StatusField',
      // List view cell
      Cell: '/components/StatusCell',
      // Field label
      Label: '/components/StatusLabel',
      // Field description
      Description: '/components/StatusDescription',
      // Error message
      Error: '/components/StatusError',
    },
  },
}
```

**UI Field** (presentational only, no data):

```typescript
{
  name: 'refundButton',
  type: 'ui',
  admin: {
    components: {
      Field: '/components/RefundButton',
    },
  },
}
```

### Performance Best Practices

1. **Import correctly:**
   - Admin Panel: `import { Button } from '@payloadcms/ui'`
   - Frontend: `import { Button } from '@payloadcms/ui/elements/Button'`

2. **Optimize re-renders:**

   ```tsx
   // ❌ BAD: Re-renders on every form change
   const { fields } = useForm()

   // ✅ GOOD: Only re-renders when specific field changes
   const value = useFormFields(([fields]) => fields[path])
   ```

3. **Prefer Server Components** - Only use Client Components when you need:
   - State (useState, useReducer)
   - Effects (useEffect)
   - Event handlers (onClick, onChange)
   - Browser APIs (localStorage, window)

4. **Minimize serialized props** - Server Components serialize props sent to client

### Styling Components

```tsx
import './styles.scss'

export function MyComponent() {
  return <div className="my-component">Content</div>
}
```

```scss
// Use Payload's CSS variables
.my-component {
  background-color: var(--theme-elevation-500);
  color: var(--theme-text);
  padding: var(--base);
  border-radius: var(--border-radius-m);
}

// Import Payload's SCSS library
@import '~@payloadcms/ui/scss';

.my-component {
  @include mid-break {
    background-color: var(--theme-elevation-900);
  }
}
```

### Type Safety

```tsx
import type {
  TextFieldServerComponent,
  TextFieldClientComponent,
  TextFieldCellComponent,
  SelectFieldServerComponent,
  // ... etc
} from 'payload'

export const MyField: TextFieldClientComponent = (props) => {
  // Fully typed props
}
```

### Import Map

Payload auto-generates `app/(payload)/admin/importMap.js` to resolve component paths.

**Regenerate manually:**

```bash
payload generate:importmap
```

**Set custom location:**

```typescript
export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
      importMapFile: path.resolve(dirname, 'app', 'custom-import-map.js'),
    },
  },
})
```

## Custom Endpoints

```typescript
import type { Endpoint } from 'payload'
import { APIError } from 'payload'

// Always check authentication
export const protectedEndpoint: Endpoint = {
  path: '/protected',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }

    // Use req.payload for database operations
    const data = await req.payload.find({
      collection: 'posts',
      where: { author: { equals: req.user.id } },
    })

    return Response.json(data)
  },
}

// Route parameters
export const trackingEndpoint: Endpoint = {
  path: '/:id/tracking',
  method: 'get',
  handler: async (req) => {
    const { id } = req.routeParams

    const tracking = await getTrackingInfo(id)

    if (!tracking) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    return Response.json(tracking)
  },
}
```

## Drafts & Versions

```typescript
export const Pages: CollectionConfig = {
  slug: 'pages',
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
      validate: false, // Don't validate drafts
    },
    maxPerDoc: 100,
  },
  access: {
    read: ({ req: { user } }) => {
      // Public sees only published
      if (!user) return { _status: { equals: 'published' } }
      // Authenticated sees all
      return true
    },
  },
}

// Create draft
await payload.create({
  collection: 'pages',
  data: { title: 'Draft Page' },
  draft: true, // Skips required field validation
})

// Read with drafts
const page = await payload.findByID({
  collection: 'pages',
  id: '123',
  draft: true, // Returns draft if available
})
```

## Field Type Guards

```typescript
import {
  fieldAffectsData,
  fieldHasSubFields,
  fieldIsArrayType,
  fieldIsBlockType,
  fieldSupportsMany,
  fieldHasMaxDepth,
} from 'payload'

function processField(field: Field) {
  // Check if field stores data
  if (fieldAffectsData(field)) {
    console.log(field.name) // Safe to access
  }

  // Check if field has nested fields
  if (fieldHasSubFields(field)) {
    field.fields.forEach(processField) // Safe to access
  }

  // Check field type
  if (fieldIsArrayType(field)) {
    console.log(field.minRows, field.maxRows)
  }

  // Check capabilities
  if (fieldSupportsMany(field) && field.hasMany) {
    console.log('Multiple values supported')
  }
}
```

## Plugins

### Using Plugins

```typescript
import { seoPlugin } from '@payloadcms/plugin-seo'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'

export default buildConfig({
  plugins: [
    seoPlugin({
      collections: ['posts', 'pages'],
    }),
    redirectsPlugin({
      collections: ['pages'],
    }),
  ],
})
```

### Creating Plugins

```typescript
import type { Config, Plugin } from 'payload'

interface MyPluginConfig {
  collections?: string[]
  enabled?: boolean
}

export const myPlugin =
  (options: MyPluginConfig): Plugin =>
  (config: Config): Config => ({
    ...config,
    collections: config.collections?.map((collection) => {
      if (options.collections?.includes(collection.slug)) {
        return {
          ...collection,
          fields: [...collection.fields, { name: 'pluginField', type: 'text' }],
        }
      }
      return collection
    }),
  })
```

## Best Practices

### Security

1. Always set `overrideAccess: false` when passing `user` to Local API
2. Field-level access only returns boolean (no query constraints)
3. Default to restrictive access, gradually add permissions
4. Never trust client-provided data
5. Use `saveToJWT: true` for roles to avoid database lookups

### Performance

1. Index frequently queried fields
2. Use `select` to limit returned fields
3. Set `maxDepth` on relationships to prevent over-fetching
4. Use query constraints over async operations in access control
5. Cache expensive operations in `req.context`

### Data Integrity

1. Always pass `req` to nested operations in hooks
2. Use context flags to prevent infinite hook loops
3. Enable transactions for MongoDB (requires replica set) and Postgres
4. Use `beforeValidate` for data formatting
5. Use `beforeChange` for business logic

### Type Safety

1. Run `generate:types` after schema changes
2. Import types from generated `payload-types.ts`
3. Type your user object: `import type { User } from '@/payload-types'`
4. Use `as const` for field options
5. Use field type guards for runtime type checking

### Organization

1. Keep collections in separate files
2. Extract access control to `access/` directory
3. Extract hooks to `hooks/` directory
4. Use reusable field factories for common patterns
5. Document complex access control with comments

## Common Gotchas

1. **Local API Default**: Access control bypassed unless `overrideAccess: false`
2. **Transaction Safety**: Missing `req` in nested operations breaks atomicity
3. **Hook Loops**: Operations in hooks can trigger the same hooks
4. **Field Access**: Cannot use query constraints, only boolean
5. **Relationship Depth**: Default depth is 2, set to 0 for IDs only
6. **Draft Status**: `_status` field auto-injected when drafts enabled
7. **Type Generation**: Types not updated until `generate:types` runs
8. **MongoDB Transactions**: Require replica set configuration
9. **SQLite Transactions**: Disabled by default, enable with `transactionOptions: {}`
10. **Point Fields**: Not supported in SQLite

## Additional Context Files

For deeper exploration of specific topics, refer to the context files located in `.cursor/rules/`:

### Available Context Files

1. **`payload-overview.md`** - High-level architecture and core concepts
   - Payload structure and initialization
   - Configuration fundamentals
   - Database adapters overview

2. **`security-critical.md`** - Critical security patterns (⚠️ IMPORTANT)
   - Local API access control
   - Transaction safety in hooks
   - Preventing infinite hook loops

3. **`collections.md`** - Collection configurations
   - Basic collection patterns
   - Auth collections with RBAC
   - Upload collections
   - Drafts and versioning
   - Globals

4. **`fields.md`** - Field types and patterns
   - All field types with examples
   - Conditional fields
   - Virtual fields
   - Field validation
   - Common field patterns

5. **`field-type-guards.md`** - TypeScript field type utilities
   - Field type checking utilities
   - Safe type narrowing
   - Runtime field validation

6. **`access-control.md`** - Permission patterns
   - Collection-level access
   - Field-level access
   - Row-level security
   - RBAC patterns
   - Multi-tenant access control

7. **`access-control-advanced.md`** - Complex access patterns
   - Nested document access
   - Cross-collection permissions
   - Dynamic role hierarchies
   - Performance optimization

8. **`hooks.md`** - Lifecycle hooks
   - Collection hooks
   - Field hooks
   - Hook context patterns
   - Common hook recipes

9. **`queries.md`** - Database operations
   - Local API usage
   - Query operators
   - Complex queries with AND/OR
   - Performance optimization

10. **`endpoints.md`** - Custom API endpoints
    - REST endpoint patterns
    - Authentication in endpoints
    - Error handling
    - Route parameters

11. **`adapters.md`** - Database and storage adapters
    - MongoDB, PostgreSQL, SQLite patterns
    - Storage adapter usage (S3, Azure, GCS, etc.)
    - Custom adapter development

12. **`plugin-development.md`** - Creating plugins
    - Plugin architecture
    - Modifying configuration
    - Plugin hooks
    - Best practices

13. **`components.md`** - Custom Components
    - Component types (Root, Collection, Global, Field)
    - Server vs Client Components
    - Component paths and definition
    - Default and custom props
    - Using hooks
    - Performance best practices
    - Styling components

## Resources

- Docs: https://payloadcms.com/docs
- LLM Context: https://payloadcms.com/llms-full.txt
- GitHub: https://github.com/payloadcms/payload
- Examples: https://github.com/payloadcms/payload/tree/main/examples
- Templates: https://github.com/payloadcms/payload/tree/main/templates
