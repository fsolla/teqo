import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C115 — push-channel state for the Google→Teqo direction (edits made in the
 * Google Calendar come back to the campaign activities). Hand-written like its
 * C114 sibling `20260811_133332_add_google_calendar_sync`: `migrate:create`
 * has no snapshot baseline for the table (the sibling is a hand-written
 * migration without a `.json`), so the generator would re-emit the whole
 * `CREATE TABLE` and fail with "relation already exists" on apply.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "push_channel_id" varchar;
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "push_channel_resource_id" varchar;
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "push_channel_expires_at" timestamp(3) with time zone;
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "push_channel_secret" varchar;
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "push_channel_error" varchar;
    ALTER TABLE "google_calendar_sync" ADD COLUMN IF NOT EXISTS "last_seen_event_ids" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "last_seen_event_ids";
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "push_channel_error";
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "push_channel_secret";
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "push_channel_expires_at";
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "push_channel_resource_id";
    ALTER TABLE "google_calendar_sync" DROP COLUMN IF EXISTS "push_channel_id";
  `)
}
