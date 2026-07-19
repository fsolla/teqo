import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Makes the supporter list's `ILIKE '%q%'` search on `contact.name`/`contact.city`
 * sargable via trigram GIN indexes, instead of a sequential scan per page (C8
 * Fase 2 — escala-dry-pos-c6). Hand-written (not a Payload field/schema change):
 * `pg_trgm` and the indexes are pure Postgres performance additions with no
 * corresponding collection config. Idempotent — safe to re-run.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "contact_name_trgm_idx" ON "contact" USING gin ("name" gin_trgm_ops);`,
  )
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "contact_city_trgm_idx" ON "contact" USING gin ("city" gin_trgm_ops);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "contact_city_trgm_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "contact_name_trgm_idx";`)
  // `pg_trgm` is left installed: dropping a cluster-wide extension in a
  // single feature's `down` is unnecessarily invasive and other migrations
  // may also depend on it going forward.
}
