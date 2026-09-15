import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity" ALTER COLUMN "municipality_id" DROP NOT NULL;
  ALTER TABLE "activity" ADD COLUMN "google_event_id" varchar;
  ALTER TABLE "activity" ADD COLUMN "google_calendar_id" varchar;
  CREATE UNIQUE INDEX "activity_google_event_id_idx" ON "activity" USING btree ("google_event_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // NOT NULL first: down cannot succeed while imported (municipality-less)
  // activities exist, and failing before dropping anything leaves the schema
  // intact for a retry. `IF EXISTS` keeps the retry idempotent.
  await db.execute(sql`
   ALTER TABLE "activity" ALTER COLUMN "municipality_id" SET NOT NULL;
  DROP INDEX IF EXISTS "activity_google_event_id_idx";
  ALTER TABLE "activity" DROP COLUMN IF EXISTS "google_event_id";
  ALTER TABLE "activity" DROP COLUMN IF EXISTS "google_calendar_id";`)
}
