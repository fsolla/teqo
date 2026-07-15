---
name: local-database
description: Set up, refresh, and safely use the Teqo local Postgres database, and copy production content locally with `pnpm db:pull`. Use when starting local development, when the local database is empty or stale, when preparing the test database, or when the user mentions the local DB, docker-compose, db:pull, or seeding local data. Enforces that local development and tests never touch the production Neon database.
---

# Teqo Local Database

Production is a live **Neon Postgres** with real citizens' PII. Local development and tests run against a **local Docker Postgres** and must never connect to production.

## Guardrails already in place (do not weaken them)

- `pnpm dev` runs `scripts/guard-dev-db.mjs` and **refuses to start** if `DATABASE_URL` is a non-local host. Escape hatch: `ALLOW_REMOTE_DB=true` (use only with a very good reason).
- Tests load `.env.test` (database `teqo_test`) and call `assertTestDatabase()` (`tests/helpers/assertTestDatabase.ts`), which **throws** unless the database name ends in `_test`.
- Never repoint `DATABASE_URL` in `.env`, `.env.local`, or `.env.test` at Neon. `.env.test` is committed and local-only on purpose.

## Local connection values

- Dev database: `postgresql://teqo:teqo@localhost:5432/teqo`
- Test database: `postgresql://teqo:teqo@localhost:5432/teqo_test`
- Local Postgres major version is pinned to **17** in `docker-compose.yml` to match production Neon.

## First-time setup

1. Ensure Docker is running (`open -a Docker` on macOS if the daemon is down).
2. `pnpm db:start` — boots local Postgres and auto-creates `teqo_test`.
3. Set `DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo` in `.env.local`.
4. Load schema + data (pick one):
   - Mirror prod content (recommended): see "Refresh local content from prod" below.
   - Empty schema from migrations: `pnpm migrate`.
5. `pnpm dev`.

Stop the database with `pnpm db:stop`.

## Refresh local content from prod (`pnpm db:pull`)

```bash
PROD_DATABASE_URL="<unpooled Neon URL>" pnpm db:pull
```

- The unpooled URL is `DATABASE_URL_UNPOOLED` in `.env.local`.
- `scripts/db-pull.mjs` only **reads** prod (via `pg_dump`) and only **writes** local; it refuses any non-local target.
- It **excludes PII**: row data of `contact`, `signature`, `subscription` (and their `_rels`) is not copied; the table structure is kept.
- It resets and rebuilds the local `public` schema, so it overwrites local data.

## Prepare / reset the test database

The test DB needs the schema applied via migrations:

```bash
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate
```

Then run `pnpm test` (or `pnpm test:int` / `pnpm test:e2e`). Playwright injects the test DB into its own dev server and never reuses a running one.

## Never do

- Point any `DATABASE_URL` at Neon for dev or tests.
- Run the test suite against a database not ending in `_test`.
- Try to use `db:pull` to push local → prod (it cannot; it is read-only on the source).

## Related

- Schema changes and migrations: use the `payload-migrations` skill.
