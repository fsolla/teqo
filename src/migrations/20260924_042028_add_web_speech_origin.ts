import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_speech_origin" AS ENUM('camara', 'web');
  CREATE TYPE "public"."enum_speech_platform" AS ENUM('youtube', 'instagram', 'radio', 'audio');
  CREATE TABLE "internet_speech_media" (
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
  
  ALTER TABLE "speech" ADD COLUMN "origin" "enum_speech_origin" DEFAULT 'camara' NOT NULL;
  ALTER TABLE "speech" ADD COLUMN "platform" "enum_speech_platform";
  ALTER TABLE "speech" ADD COLUMN "external_id" varchar;
  ALTER TABLE "speech" ADD COLUMN "source_url" varchar;
  ALTER TABLE "speech" ADD COLUMN "title" varchar;
  ALTER TABLE "speech" ADD COLUMN "channel" varchar;
  ALTER TABLE "speech" ADD COLUMN "mirrored_media_id" integer;
  ALTER TABLE "speech" ADD COLUMN "thumbnail_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "internet_speech_media_id" integer;
  CREATE INDEX "internet_speech_media_updated_at_idx" ON "internet_speech_media" USING btree ("updated_at");
  CREATE INDEX "internet_speech_media_created_at_idx" ON "internet_speech_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "internet_speech_media_filename_idx" ON "internet_speech_media" USING btree ("filename");
  ALTER TABLE "speech" ADD CONSTRAINT "speech_mirrored_media_id_internet_speech_media_id_fk" FOREIGN KEY ("mirrored_media_id") REFERENCES "public"."internet_speech_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "speech" ADD CONSTRAINT "speech_thumbnail_id_internet_speech_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."internet_speech_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_internet_speech_media_fk" FOREIGN KEY ("internet_speech_media_id") REFERENCES "public"."internet_speech_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "speech_origin_idx" ON "speech" USING btree ("origin");
  CREATE INDEX "speech_platform_idx" ON "speech" USING btree ("platform");
  CREATE INDEX "speech_mirrored_media_idx" ON "speech" USING btree ("mirrored_media_id");
  CREATE INDEX "speech_thumbnail_idx" ON "speech" USING btree ("thumbnail_id");
  CREATE INDEX "payload_locked_documents_rels_internet_speech_media_id_idx" ON "payload_locked_documents_rels" USING btree ("internet_speech_media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "internet_speech_media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "internet_speech_media" CASCADE;
  ALTER TABLE "speech" DROP CONSTRAINT "speech_mirrored_media_id_internet_speech_media_id_fk";
  
  ALTER TABLE "speech" DROP CONSTRAINT "speech_thumbnail_id_internet_speech_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_internet_speech_media_fk";
  
  DROP INDEX "speech_origin_idx";
  DROP INDEX "speech_platform_idx";
  DROP INDEX "speech_mirrored_media_idx";
  DROP INDEX "speech_thumbnail_idx";
  DROP INDEX "payload_locked_documents_rels_internet_speech_media_id_idx";
  ALTER TABLE "speech" DROP COLUMN "origin";
  ALTER TABLE "speech" DROP COLUMN "platform";
  ALTER TABLE "speech" DROP COLUMN "external_id";
  ALTER TABLE "speech" DROP COLUMN "source_url";
  ALTER TABLE "speech" DROP COLUMN "title";
  ALTER TABLE "speech" DROP COLUMN "channel";
  ALTER TABLE "speech" DROP COLUMN "mirrored_media_id";
  ALTER TABLE "speech" DROP COLUMN "thumbnail_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "internet_speech_media_id";
  DROP TYPE "public"."enum_speech_origin";
  DROP TYPE "public"."enum_speech_platform";`)
}
