import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C199 — tables of the uploaded recordings. The two trigram indexes are
 * hand-written (not a Payload field/schema change) on the same pattern as
 * `20260913_001200_add_speech_segment_trgm_index`: the recordings search runs
 * `ILIKE '%term%'` on the normalized `search_text`, and the GIN index makes it
 * sargable. Only those indexes are idempotent (`IF NOT EXISTS`); the types and
 * tables, like every Payload migration, run once.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE TYPE "public"."enum_recording_status" AS ENUM('uploading', 'processing', 'ready', 'failed');
  CREATE TYPE "public"."enum_recording_step" AS ENUM('extracting', 'transcribing', 'saving');
  CREATE TABLE "recording" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"recorded_at" timestamp(3) with time zone,
  	"status" "enum_recording_status" DEFAULT 'uploading' NOT NULL,
  	"step" "enum_recording_step",
  	"media_id" integer,
  	"duration_seconds" numeric,
  	"search_text" varchar,
  	"error" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "recording_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
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
  
  CREATE TABLE "recording_segment" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"recording_id" integer NOT NULL,
  	"order" numeric NOT NULL,
  	"start_seconds" numeric NOT NULL,
  	"end_seconds" numeric NOT NULL,
  	"text" varchar NOT NULL,
  	"search_text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "recording_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "recording_media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "recording_segment_id" integer;
  ALTER TABLE "recording" ADD CONSTRAINT "recording_media_id_recording_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."recording_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recording" ADD CONSTRAINT "recording_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recording_segment" ADD CONSTRAINT "recording_segment_recording_id_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "recording_recorded_at_idx" ON "recording" USING btree ("recorded_at");
  CREATE INDEX "recording_status_idx" ON "recording" USING btree ("status");
  CREATE INDEX "recording_media_idx" ON "recording" USING btree ("media_id");
  CREATE INDEX "recording_created_by_idx" ON "recording" USING btree ("created_by_id");
  CREATE INDEX "recording_updated_at_idx" ON "recording" USING btree ("updated_at");
  CREATE INDEX "recording_created_at_idx" ON "recording" USING btree ("created_at");
  CREATE INDEX "recording_media_updated_at_idx" ON "recording_media" USING btree ("updated_at");
  CREATE INDEX "recording_media_created_at_idx" ON "recording_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "recording_media_filename_idx" ON "recording_media" USING btree ("filename");
  CREATE INDEX "recording_segment_recording_idx" ON "recording_segment" USING btree ("recording_id");
  CREATE INDEX "recording_segment_updated_at_idx" ON "recording_segment" USING btree ("updated_at");
  CREATE INDEX "recording_segment_created_at_idx" ON "recording_segment" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recording_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recording_media_fk" FOREIGN KEY ("recording_media_id") REFERENCES "public"."recording_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recording_segment_fk" FOREIGN KEY ("recording_segment_id") REFERENCES "public"."recording_segment"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "payload_locked_documents_rels_recording_id_idx" ON "payload_locked_documents_rels" USING btree ("recording_id");
   CREATE INDEX "payload_locked_documents_rels_recording_media_id_idx" ON "payload_locked_documents_rels" USING btree ("recording_media_id");
   CREATE INDEX "payload_locked_documents_rels_recording_segment_id_idx" ON "payload_locked_documents_rels" USING btree ("recording_segment_id");
   CREATE INDEX IF NOT EXISTS "recording_search_text_trgm_idx" ON "recording" USING gin ("search_text" gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS "recording_segment_search_text_trgm_idx" ON "recording_segment" USING gin ("search_text" gin_trgm_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "recording_search_text_trgm_idx";
   DROP INDEX IF EXISTS "recording_segment_search_text_trgm_idx";
   ALTER TABLE "recording" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "recording_media" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "recording_segment" DISABLE ROW LEVEL SECURITY;
   DROP TABLE "recording" CASCADE;
  DROP TABLE "recording_media" CASCADE;
  DROP TABLE "recording_segment" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recording_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recording_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recording_segment_fk";
  
  DROP INDEX "payload_locked_documents_rels_recording_id_idx";
  DROP INDEX "payload_locked_documents_rels_recording_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_recording_segment_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recording_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recording_media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recording_segment_id";
  DROP TYPE "public"."enum_recording_status";
  DROP TYPE "public"."enum_recording_step";`)
}
