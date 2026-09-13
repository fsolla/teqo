import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C154 — backfill the speech-level `search_text` (normalized concatenation of
 * the segments, already normalized in `speech_segment.search_text`) and index
 * it with GIN trigram, so the acervo search paginates by speech with one
 * `ILIKE '%term%'` per query. Hand-written (data + index, not a field change);
 * `upsertSpeechBundle` keeps the column in sync from now on.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "speech"
    SET "search_text" = COALESCE("segments"."search_text", '')
    FROM (
      SELECT "speech_id", string_agg("search_text", ' ' ORDER BY "order") AS "search_text"
      FROM "speech_segment"
      GROUP BY "speech_id"
    ) AS "segments"
    WHERE "speech"."id" = "segments"."speech_id";`)
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "speech_search_text_trgm_idx" ON "speech" USING gin ("search_text" gin_trgm_ops);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "speech_search_text_trgm_idx";`)
  // The backfill is data, not schema: `down` drops only the index. The column
  // itself is owned by the previous migration.
}
