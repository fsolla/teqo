import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C115 — `activity.lastMirroredChangeAt`: the last time a field the Google
 * mirror reflects changed in the Teqo. The conflict clock rule (D3) compares
 * the Google event's `updated` against THIS instant instead of `updatedAt`,
 * which non-mirrored writes (task toggles, updates feed, result records)
 * bump without ever reaching the mirror. Hand-written for the same reason as
 * its C114/C115 siblings: the migration generator has no snapshot baseline
 * for `google_calendar_sync` and would re-emit its whole CREATE TABLE.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "last_mirrored_change_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "activity" DROP COLUMN IF EXISTS "last_mirrored_change_at";
  `)
}
