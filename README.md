# Teqo

Teqo starts as the official digital platform for **deputado Jorge Solla** and evolves into a **white-label civic engagement platform** for politicians in Brazil.

The goal is to help political teams build direct, durable relationships with their base without depending on Big Tech social platforms as the primary channel.

## Mission

- Strengthen direct communication between representatives and citizens.
- Reduce platform dependency risk by owning audience and data channels.
- Provide reusable building blocks so each political team can launch quickly.

## Product Direction

### Phase 1: Jorge Solla Website

Initial delivery focuses on Jorge Solla's public website, editorial CMS, and the internal `/campanha` tool:

- Public-facing content and updates (news/`post` + `tag` live)
- Institutional pages and biography (still pending a `Pages` collection)
- Internal campaign operations: electoral nuclei, leaderships, estimates, updates, WhatsApp invites
- Editorial operations through Payload CMS

### Phase 2: White-Label Platform

Teqo then becomes a configurable base product for other politicians in Brazil:

- Multi-tenant and reusable architecture
- Brand and content customization per mandate/campaign
- Shared core modules for communication and engagement
- Operational autonomy with self-hosted owned channels

## Local Development

> **Production safety:** the production database is a live Neon Postgres holding real citizens' data. Local development and tests run against a **local** Postgres and must never point at production. `pnpm dev` refuses to start against a non-local database, and the test suite refuses any database whose name doesn't end in `_test`.

### First-time setup

1. Install dependencies: `pnpm install`
2. Create your env file: `cp .env.example .env.local`
3. Start Docker, then start the local database: `pnpm db:start`
   - This runs Postgres 17 (matching production) and auto-creates a `teqo_test` database for the test suite.
4. Make sure `DATABASE_URL` in `.env.local` points at local:
   ```
   DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo
   ```
5. Load a schema + content into the local database — pick one:
   - **Mirror production content (recommended):** `PROD_DATABASE_URL="<unpooled Neon URL>" pnpm db:pull`
     Copies production's schema and content into local. It only reads production and **excludes supporter PII** (`contact`/`signature`/`subscription` data).
   - **Empty schema from migrations:** `pnpm migrate`
6. Start the dev server: `pnpm dev`
7. Open: `http://localhost:3000`

Useful scripts: `pnpm db:start` / `pnpm db:stop` (local Postgres), `pnpm db:pull` (refresh local content from prod), `pnpm db:seed:posts` (import news posts/tags fresh from the live jorgesolla.com.br site into the local db; idempotent by slug, refuses a non-local database), `pnpm db:seed:tse` (import TSE 2022 Bahia election results into the local db; idempotent per year/office/turn scope, refuses a non-local database).

### Content & cache revalidation

Public news pages (`/[type]`, `/[type]/[category]`, articles, and the home news list) are cached under a shared `posts` tag. Editing a post or tag in the deployed admin self-revalidates via `afterChange` hooks. Any write that bypasses the deployed runtime — a direct-DB seed (`pnpm db:seed:posts`), SQL, Onda 0 migrations, or a restore — does **not** bust production's cache, so afterwards call the secured endpoint:

```
# News (default tag: posts)
curl -X POST "https://<prod-domain>/api/revalidate" -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Privacy policy after Onda 0 provision (tag: global_privacy-policy)
curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

`REVALIDATE_SECRET` must be set in the Vercel production env (see `.env.example`). See the "Posts & Tags" section of `AGENTS.md` for the full model.

### Database migrations

Schema is managed by committed Payload migrations (`src/migrations/`); `push` is disabled everywhere.

To change the schema:

1. Edit the collection/global/field config.
2. Generate a migration: `pnpm migrate:create <name>`
3. Review and commit the generated files in `src/migrations/` (both `.ts` and `.json`, plus `index.ts`).
4. Apply it locally: `pnpm migrate` (check status anytime with `pnpm migrate:status`).

**Deploying to production:** `pnpm build` runs `payload migrate` before building, so every Vercel deploy automatically applies pending migrations to the production database. Do not run migrations against production by hand.

### Running tests

Tests use the isolated `teqo_test` database (config in `.env.test`). Prepare its schema once with:

```
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate
```

Then run:

- `pnpm test` — unit + integration
- `pnpm test:e2e` — Playwright (requires the test DB schema and a free port)
- `pnpm test:all` — unit + integration + E2E

## Tech Stack

- Payload CMS
- Next.js
- PostgreSQL (via `@payloadcms/db-postgres`)
- TypeScript

## Campaign (`/campanha`)

Internal campaign tool for electoral nuclei, local leaderships, vote estimates, field updates, and WhatsApp invites. Authenticated separately from `/admin` via the `campaignUser` collection (`geral` / `coordenador` / `lideranca`). Operational status and decisions: [`.cursor/rules/projects/nucleos-eleitorais.mdc`](.cursor/rules/projects/nucleos-eleitorais.mdc). Conventions and deploy checklist: `AGENTS.md` (“Campaign auth” / “Campaign nuclei MVP”).

**Production blocker:** do not load real leadership data or enable invites until counsel-approved `Consent.key = 'lideranca-autopreenchimento'` exists. Absolute invite URLs require `NEXT_PUBLIC_SITE_URL` as an exact HTTPS DNS origin in production.

## Roadmap

Backlog and future plans live in [`docs/roadmap.md`](docs/roadmap.md) (blockers, public site, `/campanha` next cycles, admin RBAC, white-label).
