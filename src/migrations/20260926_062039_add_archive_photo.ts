import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // C231 — archivePhoto only. The generated diff was hand-trimmed: the previous
  // snapshot in the chain (20260924_123940_add_content_piece_people.json) was
  // desynced from earlier merged deliveries (it lost internet_speech_media and
  // the recording rels), so `migrate:create` re-created already-existing objects
  // (internet_speech_media, recording_topics/scopes/rels, speech.*,
  // content_piece.link_failure_reason, recording.year/classified_by) — applying
  // those would fail on every database that already ran the chain. The full
  // snapshot written alongside this migration restores the accumulated schema
  // for the next diff.
  await db.execute(sql`
   CREATE TABLE "archive_photo_tags" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"name" varchar NOT NULL
   );

   CREATE TABLE "archive_photo_albums" (
   	"_order" integer NOT NULL,
   	"_parent_id" integer NOT NULL,
   	"id" varchar PRIMARY KEY NOT NULL,
   	"album_id" varchar NOT NULL,
   	"title" varchar NOT NULL
   );

   CREATE TABLE "archive_photo" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"flickr_id" varchar NOT NULL,
   	"alt" varchar NOT NULL,
   	"title" varchar,
   	"description" varchar,
   	"taken_at" varchar,
   	"posted_at" varchar,
   	"geo_latitude" numeric,
   	"geo_longitude" numeric,
   	"exif" jsonb,
   	"source_url" varchar,
   	"owner" varchar,
   	"license" varchar,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"url" varchar,
   	"thumbnail_u_r_l" varchar,
   	"filename" varchar,
   	"mime_type" varchar,
   	"filesize" numeric,
   	"width" numeric,
   	"height" numeric,
   	"focal_x" numeric,
   	"focal_y" numeric
   );

   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "archive_photo_id" integer;
   ALTER TABLE "archive_photo_tags" ADD CONSTRAINT "archive_photo_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "archive_photo_albums" ADD CONSTRAINT "archive_photo_albums_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "archive_photo_tags_order_idx" ON "archive_photo_tags" USING btree ("_order");
   CREATE INDEX "archive_photo_tags_parent_id_idx" ON "archive_photo_tags" USING btree ("_parent_id");
   CREATE INDEX "archive_photo_albums_order_idx" ON "archive_photo_albums" USING btree ("_order");
   CREATE INDEX "archive_photo_albums_parent_id_idx" ON "archive_photo_albums" USING btree ("_parent_id");
   CREATE UNIQUE INDEX "archive_photo_flickr_id_idx" ON "archive_photo" USING btree ("flickr_id");
   CREATE INDEX "archive_photo_updated_at_idx" ON "archive_photo" USING btree ("updated_at");
   CREATE INDEX "archive_photo_created_at_idx" ON "archive_photo" USING btree ("created_at");
   CREATE UNIQUE INDEX "archive_photo_filename_idx" ON "archive_photo" USING btree ("filename");
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_archive_photo_fk" FOREIGN KEY ("archive_photo_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "payload_locked_documents_rels_archive_photo_id_idx" ON "payload_locked_documents_rels" USING btree ("archive_photo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "archive_photo_tags" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "archive_photo_albums" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "archive_photo" DISABLE ROW LEVEL SECURITY;
   DROP TABLE "archive_photo_tags" CASCADE;
   DROP TABLE "archive_photo_albums" CASCADE;
   DROP TABLE "archive_photo" CASCADE;
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_archive_photo_fk";
   DROP INDEX "payload_locked_documents_rels_archive_photo_id_idx";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "archive_photo_id";`)
}
