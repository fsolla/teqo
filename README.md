# Teqo

> **License:** proprietary — **All Rights Reserved** (© Francisco Ignácio Fontoura Solla). Portfolio / demonstration only. **Not** open source. Use, copy, or redistribution requires prior written permission (`fsolla@pm.me`). See [`LICENSE`](LICENSE).
>
> **Sensitive field material** belongs in `/private/` on local checkouts (gitignored). Cloud agents: use public-clean docs; report sensitive deliverables in chat — do not commit them.

> **Cheatsheet de operação agentic (humanos)** — o fluxo em 5 linhas:
>
> 1. O agente roda `pnpm agent:claim` (ou `pnpm worktree next --issue N`) e pega a próxima Issue `ready` por prioridade (`prio:P0..P3`). O **tracker de Issues, o código, os PRs e o CI vivem no GitHub** (`github.com/fsolla/teqo`).
> 2. Ele implementa, roda o fast gate (`lint + typecheck + unit`) e `pnpm push -u origin HEAD` — abre a PR para `main` (Ready, `Closes #N`).
> 3. CI verde (`CI (PR) / checks`) → o safety net `agent-pr-ready-automerge.yml` arma o **auto-merge nativo** (rebase) — o servidor só mergea com o required check verde.
> 4. Publicar é **manual**: dispatch de `deploy.yml` roda a suíte full (`verify`) e o job `deploy` publica no homeserver (`jorgesolla1313.com.br`, runner self-hosted) — migrações aplicadas antes do rollout. Nada é automático pós-merge.
> 5. Secrets humanos (uma vez): `GITHUB_TOKEN` (PAT com escopo `repo` + `issues: write`) para os scripts de agente/PR (`pnpm issue`/`agent:*`, `github-pr.mjs`); envs de prod em `~/stack/teqo-1313.env` no homeserver. Branch protection de `main` já aplicada (reaplicar: `pnpm configure:branch-protection`).
>
> Comandos: `pnpm agent:claim | agent:register | agent:prioritize | agent:file-miss | worktree next` e `pnpm db:seed:minimal`.
> Labels: estado `ready|in-progress|blocked|done|in-prod`, `prio:P0..P3`, `kind:*`, `needs:migration|consent`, `requirements-changed`.
> **Agente faz sozinho:** claim → implementar → PR → main. **Só humano:** deploy (dispatch), envs do homeserver, branch protection, runbook de rollback.
> Tudo em detalhe: [`docs/AGENT-OPS.md`](docs/AGENT-OPS.md) · CI: `.github/workflows/ci-pr.yml` · Deploy: `.github/workflows/deploy.yml`.

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
- Internal campaign operations: municípios (435, pré-definidos), leaderships, estimates, updates, WhatsApp invites
- Editorial operations through Payload CMS

### Phase 2: White-Label Platform

Teqo then becomes a configurable base product for other politicians in Brazil:

- Multi-tenant and reusable architecture
- Brand and content customization per mandate/campaign
- Shared core modules for communication and engagement
- Operational autonomy with self-hosted owned channels

## Local Development

> **Production safety:** the production database is a live Postgres on the homeserver (`teqo_1313`) holding real citizens' data. Local development and tests run against a **local** Postgres and must never point at production. `pnpm dev` refuses to start against a non-local database, and the test suite refuses any database whose name doesn't end in `_test`.

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
   - **Mirror production content (recommended):** `PROD_DATABASE_URL="<prod connection string>" pnpm db:pull`
     Copies production's schema and content into local. It only reads production and **excludes supporter PII** (`contact`/`signature`/`subscription` data). The prod string is the `DATABASE_URL` of `~/stack/teqo-1313.env` on the homeserver (Postgres `teqo_1313`).
   - **Empty schema from migrations:** `pnpm migrate`
6. Start the dev server: `pnpm dev`
7. Open: `http://localhost:3000`

Useful scripts: `pnpm db:start` / `pnpm db:stop` (local Postgres — always the same shared container via `-p teqo`, from any directory), `pnpm db:pull` (refresh local content from prod), `pnpm db:seed:posts` (import news posts/tags fresh from the live jorgesolla.com.br site into the local db; idempotent by slug, refuses a non-local database), `pnpm db:seed:tse` (import TSE 2014/2018/2022 Bahia election results into the local db; idempotent per year/office/turn scope, refuses a non-local database), `pnpm build:election-aggregates` (regenerate the committed TSE aggregate artifact in `src/lib/electionAggregates/` from locally seeded data).

Parallel worktrees get isolated environments: `pnpm worktree next` derives a per-branch dev port (`3100+slot`) and its own databases (`teqo_wt<slot>` / `teqo_wt<slot>_test`), so agents never fight over port 3000 or the shared `teqo_test`. See `.agents/skills/local-database`.

### Content & cache revalidation

Public news pages (`/[type]`, `/[type]/[category]`, articles, and the home news list) are cached under a shared `posts` tag. Editing a post or tag in the deployed admin self-revalidates via `afterChange` hooks. Any write that bypasses the deployed runtime — a direct-DB seed (`pnpm db:seed:posts`), SQL, Onda 0 migrations, or a restore — does **not** bust production's cache, so afterwards call the secured endpoint:

```
# News (default tag: posts)
curl -X POST "https://<prod-domain>/api/revalidate" -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Privacy policy after Onda 0 provision (tag: global_privacy-policy)
curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

`REVALIDATE_SECRET` must be set in the production env (`~/stack/teqo-1313.env` on the homeserver — see `.env.example`). See the "Posts & Tags" section of `AGENTS.md` for the full model.

### Database migrations

Schema is managed by committed Payload migrations (`src/migrations/`); `push` is disabled everywhere.

To change the schema:

1. Edit the collection/global/field config.
2. Generate a migration: `pnpm migrate:create <name>`
3. Review and commit the generated files in `src/migrations/` (both `.ts` and `.json`, plus `index.ts`).
4. Apply it locally: `pnpm migrate` (check status anytime with `pnpm migrate:status`).

**Deploying to production:** merges to `main` with production changes are deployed by the `deploy` job of `ci.yml` (windowed — see `docs/AGENT-OPS.md`); the remote script (`scripts/deploy-homeserver.sh`) builds on the homeserver and applies pending migrations through the compose maintenance service `teqo-1313-migrate` **before** the rollout. Do not run migrations against production by hand. Runbook (rollback, known failures): `docs/ops/teqo-1313-deploy.md`.

### Running tests

Tests use the isolated `teqo_test` database (config in `.env.test`). Prepare its schema once with:

```
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate
```

Then run:

- `pnpm test` — unit + integration
- `pnpm test:e2e` — Playwright (requires the test DB schema and a free port)
- `pnpm test:all` — unit + integration + E2E

Quality gates (also enforced by CI on GitHub Actions — `ci-pr.yml`): `pnpm lint` (zero warnings — `--max-warnings=0`), `pnpm typecheck`, and `pnpm exec knip` (dead files/dependencies fail; delete what your change orphaned). Standards: `.agents/rules/engineering-standards.mdc`.

## Tech Stack

- Payload CMS
- Next.js
- PostgreSQL (via `@payloadcms/db-postgres`)
- TypeScript

## Campaign (`/campanha`)

Internal campaign tool for municípios (435 pré-definidos), local leaderships, vote estimates, field updates, and WhatsApp invites. Authenticated separately from `/admin` via the `campaignUser` collection (`coordinator` / `advisor` / `leader` / `candidate`). Operational status and decisions: [`.agents/rules/projects/nucleos-eleitorais.mdc`](.agents/rules/projects/nucleos-eleitorais.mdc). Conventions and deploy checklist: `AGENTS.md` (“Campaign auth” / “Campaign Municípios model”).

**Production blocker:** do not load real leadership data or enable invites until counsel-approved `Consent.key = 'lideranca-autopreenchimento'` exists. Absolute invite URLs require `NEXT_PUBLIC_SITE_URL` as an exact HTTPS DNS origin in production.

## Roadmap

Backlog and future plans live as tracked [GitHub Issues](https://github.com/fsolla/teqo/issues) (spec + deps + prio + model per issue; flow skills: `plan-issue` → `work-issue` → `project-status`; `docs/roadmap.md` is a frozen legacy stub).
