---
name: payload-migrations
description: Create, apply, and deploy Payload schema migrations for the Teqo project (Postgres, push disabled). Use when changing any collection/global/field config, adding indexes or enums, reconciling schema drift, writing a data migration, or when the user mentions migrations, migrate:create, or applying schema changes to production. Explains how migrations reach the production Neon database on deploy.
---

# Teqo Payload Migrations

Schema is managed exclusively by committed migrations in `src/migrations/`. `push: false` is set in `payload.config.ts` for every environment — never enable it against a remote database.

## How it deploys

`pnpm build` runs `payload migrate` before `next build`. On Vercel, the build runs with the production `DATABASE_URL`, so **every deploy applies pending migrations to production automatically**. Do not run `pnpm migrate` against production by hand.

Production is already baselined at migration `20260715_163458_initial` (marked applied in prod's `payload_migrations`). **Never regenerate, rename, or replace the initial migration** — doing so would make prod try to recreate existing tables.

Current chain (`src/migrations/index.ts`, order matters):

1. `20260715_163458_initial` — baseline.
2. `20260715_163500_consent_text_to_jsonb` — hand-written `Consent.text` `varchar` → `jsonb` reconciliation.
3. `20260715_181058_add_post_and_tag` — creates the `post`/`tag` tables (+ versions/`_rels`) and the `enum_post_type` (`noticia|campanha|artigo|evento`) enum.
4. `20260715_215834_rename_tag_visible_to_hidden` — hand-written, data-preserving inversion of the tag visibility flag (`visible` → `hidden`, backfilled as its logical inverse).

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

Two existing examples: `src/migrations/20260715_163500_consent_text_to_jsonb.ts` (guarded type reconciliation) and `src/migrations/20260715_215834_rename_tag_visible_to_hidden.ts` (a data-preserving column rename that backfills `hidden = NOT visible` instead of letting the generated diff drop + recreate the column and lose which tags were toggled). Follow the consent example's guard pattern:

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

### Guard rails for data migrations (learned from D3, 2026-07-25)

The whatsapp consent-key migration originally targeted `WHERE "key" IS NULL` while the prod-shaped row held `''` — it ran "green" everywhere and tagged nothing. For every hand-written data migration:

1. **Log affected-row counts.** `UPDATE ... RETURNING` (or `rowCount`) plus a `RAISE NOTICE`/log of the count — the Vercel build log shows it, so a silent no-op is visible at deploy time. An idempotent re-run legitimately reports 0; the first run must not.
2. **Pin it with a spec** exercising the SQL against the realistic data variants (e.g. `NULL` **and** `''`). Precedents: `tests/unit/contactCityMigration.unit.spec.ts`, `tests/int/submitWhatsapp.int.spec.ts`.
3. **Rehearse against prod-shaped data**: `pnpm db:pull`, then apply the migration locally on the pulled copy before deploying — local fixtures and production rows drift, which is exactly how the `NULL` vs `''` miss happened.

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
