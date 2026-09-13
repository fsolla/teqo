import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C153 — the C154 catalog search runs `ILIKE '%term%'` on the normalized
 * `speech_segment.search_text`; the GIN trigram index makes it sargable
 * instead of a sequential scan per query. Hand-written (not a Payload
 * field/schema change) and idempotent — safe to re-run.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "speech_segment_search_text_trgm_idx" ON "speech_segment" USING gin ("search_text" gin_trgm_ops);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "speech_segment_search_text_trgm_idx";`)
  // `pg_trgm` is left installed: dropping a cluster-wide extension in a single
  // feature's `down` is unnecessarily invasive (same rationale as the contact
  // trigram index migration).
}
