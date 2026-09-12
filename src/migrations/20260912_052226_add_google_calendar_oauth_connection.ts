import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C149 — `googleCalendarSync` gains the OAuth connection fields (C149). The
 * generated migration also re-emitted the already-applied
 * `supporter_import_batch.actor_id DROP NOT NULL` statement
 * (applied by `20260824_010000_make_supporter_import_batch_actor_nullable`);
 * it was removed by hand so the apply does not fail on a duplicate change —
 * same drift handled in the C114 migration.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "google_calendar_sync" ADD COLUMN "oauth_refresh_token" varchar;
  ALTER TABLE "google_calendar_sync" ADD COLUMN "oauth_scope" varchar;
  ALTER TABLE "google_calendar_sync" ADD COLUMN "oauth_connected_at" timestamp(3) with time zone;
  ALTER TABLE "google_calendar_sync" ADD COLUMN "oauth_error_at" timestamp(3) with time zone;
  ALTER TABLE "google_calendar_sync" ADD COLUMN "oauth_error" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "google_calendar_sync" DROP COLUMN "oauth_refresh_token";
  ALTER TABLE "google_calendar_sync" DROP COLUMN "oauth_scope";
  ALTER TABLE "google_calendar_sync" DROP COLUMN "oauth_connected_at";
  ALTER TABLE "google_calendar_sync" DROP COLUMN "oauth_error_at";
  ALTER TABLE "google_calendar_sync" DROP COLUMN "oauth_error";`)
}
