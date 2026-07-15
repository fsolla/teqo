---
name: payload-migrations
description: Create, apply, and deploy Payload schema migrations for the Teqo project (Postgres, push disabled). Use when changing any collection/global/field config, adding indexes or enums, reconciling schema drift, writing a data migration, or when the user mentions migrations, migrate:create, or applying schema changes to production. Explains how migrations reach the production Neon database on deploy.
---

# Teqo Payload Migrations

Schema is managed exclusively by committed migrations in `src/migrations/`. `push: false` is set in `payload.config.ts` for every environment — never enable it against a remote database.

## How it deploys

`pnpm build` runs `payload migrate` before `next build`. On Vercel, the build runs with the production `DATABASE_URL`, so **every deploy applies pending migrations to production automatically**. Do not run `pnpm migrate` against production by hand.

Production is already baselined at migration `20260715_163458_initial` (marked applied in prod's `payload_migrations`). **Never regenerate, rename, or replace the initial migration** — doing so would make prod try to recreate existing tables.

## Making a schema change

1. Make sure the local DB is running and current: `pnpm db:start`, `DATABASE_URL` local, `pnpm migrate`.
2. Edit the collection / global / field config.
3. Generate the migration:
   ```bash
   pnpm migrate:create <name>
   ```
4. **Review** the generated SQL in `src/migrations/<timestamp>_<name>.ts`. Confirm it does only what you intend (watch for unintended drops/renames).
5. Commit all generated files: the `.ts`, the `.json` snapshot, and the updated `src/migrations/index.ts`.
6. Apply locally and verify: `pnpm migrate` (inspect with `pnpm migrate:status`).
7. If types or the import map are affected: `pnpm generate:types` / `pnpm generate:importmap`.
8. Deploying (merge/deploy) applies it to prod via the build step.

## Hand-written data / reconciliation migrations

For changes Payload's diff can't generate (data backfills, type reconciliations), add a file manually and register it in `index.ts`. Make it **idempotent** so it's safe on databases already in the target state.

Follow the existing example `src/migrations/20260715_163500_consent_text_to_jsonb.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS ( /* guard: only run when not already in target state */ ) THEN
        /* ALTER / UPDATE ... */
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /* reverse, also guarded */
}
```

Then add both `up`/`down` and a `name` entry to `src/migrations/index.ts` (order matters — after the previous migration).

## Verifying against production (read-only, safe)

To confirm what a deploy will apply, run status pointed at prod's unpooled URL — this only reads:

```bash
DATABASE_URL="<unpooled Neon URL>" pnpm migrate:status
```

## Never do

- Set `push: true`, especially against a remote DB.
- Run `pnpm migrate` manually against production (deploys handle it).
- Edit production schema by hand — make it a migration instead.
- Modify or delete the baseline `20260715_163458_initial` migration.

## Related

- Local database setup, `db:pull`, and test DB: use the `local-database` skill.
