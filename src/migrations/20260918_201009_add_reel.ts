import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reel_feature" AS ENUM('cards');
  CREATE TYPE "public"."enum_reel_status" AS ENUM('draft', 'published', 'unpublished');
  CREATE TABLE "reel" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"feature" "enum_reel_feature" NOT NULL,
  	"status" "enum_reel_status" DEFAULT 'draft' NOT NULL,
  	"video_id" integer NOT NULL,
  	"video_with_audio_id" integer,
  	"narration_audio_id" integer,
  	"captions_id" integer,
  	"cover_id" integer NOT NULL,
  	"transcript" varchar,
  	"published_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reel_media" (
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
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reel_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reel_media_id" integer;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_video_id_reel_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."reel_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_video_with_audio_id_reel_media_id_fk" FOREIGN KEY ("video_with_audio_id") REFERENCES "public"."reel_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_narration_audio_id_reel_media_id_fk" FOREIGN KEY ("narration_audio_id") REFERENCES "public"."reel_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_captions_id_reel_media_id_fk" FOREIGN KEY ("captions_id") REFERENCES "public"."reel_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_cover_id_reel_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."reel_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reel" ADD CONSTRAINT "reel_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reel_status_idx" ON "reel" USING btree ("status");
  CREATE INDEX "reel_video_idx" ON "reel" USING btree ("video_id");
  CREATE INDEX "reel_video_with_audio_idx" ON "reel" USING btree ("video_with_audio_id");
  CREATE INDEX "reel_narration_audio_idx" ON "reel" USING btree ("narration_audio_id");
  CREATE INDEX "reel_captions_idx" ON "reel" USING btree ("captions_id");
  CREATE INDEX "reel_cover_idx" ON "reel" USING btree ("cover_id");
  CREATE INDEX "reel_created_by_idx" ON "reel" USING btree ("created_by_id");
  CREATE INDEX "reel_updated_at_idx" ON "reel" USING btree ("updated_at");
  CREATE INDEX "reel_created_at_idx" ON "reel" USING btree ("created_at");
  CREATE INDEX "reel_media_updated_at_idx" ON "reel_media" USING btree ("updated_at");
  CREATE INDEX "reel_media_created_at_idx" ON "reel_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "reel_media_filename_idx" ON "reel_media" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reel_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reel"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reel_media_fk" FOREIGN KEY ("reel_media_id") REFERENCES "public"."reel_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reel_id_idx" ON "payload_locked_documents_rels" USING btree ("reel_id");
  CREATE INDEX "payload_locked_documents_rels_reel_media_id_idx" ON "payload_locked_documents_rels" USING btree ("reel_media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reel_media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reel" CASCADE;
  DROP TABLE "reel_media" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reel_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reel_media_fk";
  
  DROP INDEX "payload_locked_documents_rels_reel_id_idx";
  DROP INDEX "payload_locked_documents_rels_reel_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reel_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reel_media_id";
  DROP TYPE "public"."enum_reel_feature";
  DROP TYPE "public"."enum_reel_status";`)
}
