import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C114 — `googleCalendarSync` collection: the configuration/state row of the
 * campaign→Google calendar mirror. Hand-written because `migrate:create`
 * re-emitted pre-existing `campaign_user.contact_id` /
 * `leadership_rels.campaign_user_id` statements (already applied by
 * `20260809_204728_add_campaign_user_contact_and_leadership_advisors` — those
 * would fail with "column already exists" on apply; kept out deliberately).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "google_calendar_sync" (
      "id" serial PRIMARY KEY NOT NULL,
      "calendar_id" varchar,
      "disabled_at" timestamp(3) with time zone,
      "last_synced_at" timestamp(3) with time zone,
      "last_success_at" timestamp(3) with time zone,
      "last_error_at" timestamp(3) with time zone,
      "last_error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "google_calendar_sync_calendar_id_idx" ON "google_calendar_sync" USING btree ("calendar_id");
    CREATE INDEX "google_calendar_sync_disabled_at_idx" ON "google_calendar_sync" USING btree ("disabled_at");
    CREATE INDEX "google_calendar_sync_updated_at_idx" ON "google_calendar_sync" USING btree ("updated_at");
    CREATE INDEX "google_calendar_sync_created_at_idx" ON "google_calendar_sync" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "google_calendar_sync_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_google_calendar_sync_fk" FOREIGN KEY ("google_calendar_sync_id") REFERENCES "public"."google_calendar_sync"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_google_calendar_sync_id_idx" ON "payload_locked_documents_rels" USING btree ("google_calendar_sync_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_google_calendar_sync_fk";
    DROP INDEX "payload_locked_documents_rels_google_calendar_sync_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "google_calendar_sync_id";
    DROP TABLE "google_calendar_sync" CASCADE;
  `)
}
