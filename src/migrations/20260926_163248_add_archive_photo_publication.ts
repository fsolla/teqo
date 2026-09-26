import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_archive_photo_publication_status" AS ENUM('draft', 'approved', 'removed');
  CREATE TABLE "photo_album" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"published" boolean DEFAULT true,
  	"removal_channel_url" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "archive_photo" ADD COLUMN "publication_status" "enum_archive_photo_publication_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "archive_photo" ADD COLUMN "municipality_name" varchar;
  ALTER TABLE "archive_photo" ADD COLUMN "municipality_slug" varchar;
  CREATE INDEX "archive_photo_publication_status_idx" ON "archive_photo" USING btree ("publication_status");
  CREATE INDEX "archive_photo_municipality_slug_idx" ON "archive_photo" USING btree ("municipality_slug");`)

  // C233 — backfill the município snapshots from the relationship already on
  // the row (the public album reads `depth 0` and the `municipality`
  // collection is campaign-only). Idempotent: only rows whose snapshot differs
  // are touched, and the count is logged so a silent no-op is visible at
  // deploy time. No photo is approved here — `publication_status` keeps its
  // `draft` default, so nothing becomes public.
  await db.execute(sql`
    DO $$
    DECLARE
      backfilled integer;
    BEGIN
      UPDATE "archive_photo" AS photo
      SET "municipality_name" = municipality."name",
          "municipality_slug" = municipality."slug"
      FROM "municipality" AS municipality
      WHERE photo."catalog_municipality_id" = municipality."id"
        AND (photo."municipality_name" IS DISTINCT FROM municipality."name"
          OR photo."municipality_slug" IS DISTINCT FROM municipality."slug");
      GET DIAGNOSTICS backfilled = ROW_COUNT;
      RAISE NOTICE 'C233 backfill archive_photo município snapshots: % linhas', backfilled;
    END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "photo_album" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "photo_album" CASCADE;
  DROP INDEX "archive_photo_publication_status_idx";
  DROP INDEX "archive_photo_municipality_slug_idx";
  ALTER TABLE "archive_photo" DROP COLUMN "publication_status";
  ALTER TABLE "archive_photo" DROP COLUMN "municipality_name";
  ALTER TABLE "archive_photo" DROP COLUMN "municipality_slug";
  DROP TYPE "public"."enum_archive_photo_publication_status";`)
}
