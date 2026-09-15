import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_speech_cut_status" AS ENUM('processing', 'published', 'unpublished', 'failed');
  CREATE TYPE "public"."enum_speech_cut_step" AS ENUM('resolving', 'cutting', 'metadata', 'publishing');
   CREATE TABLE "speech_cut" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"speech_id" integer,
   	"start_seconds" numeric NOT NULL,
  	"end_seconds" numeric NOT NULL,
  	"duration_seconds" numeric,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"status" "enum_speech_cut_status" DEFAULT 'processing' NOT NULL,
  	"step" "enum_speech_cut_step",
  	"media_id" integer,
  	"error" varchar,
  	"published_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speech_cut_id" integer;
  ALTER TABLE "speech_cut" ADD CONSTRAINT "speech_cut_speech_id_speech_id_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speech"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "speech_cut" ADD CONSTRAINT "speech_cut_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "speech_cut" ADD CONSTRAINT "speech_cut_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "speech_cut_speech_idx" ON "speech_cut" USING btree ("speech_id");
  CREATE INDEX "speech_cut_status_idx" ON "speech_cut" USING btree ("status");
  CREATE INDEX "speech_cut_media_idx" ON "speech_cut" USING btree ("media_id");
  CREATE INDEX "speech_cut_created_by_idx" ON "speech_cut" USING btree ("created_by_id");
  CREATE INDEX "speech_cut_updated_at_idx" ON "speech_cut" USING btree ("updated_at");
  CREATE INDEX "speech_cut_created_at_idx" ON "speech_cut" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speech_cut_fk" FOREIGN KEY ("speech_cut_id") REFERENCES "public"."speech_cut"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_speech_cut_id_idx" ON "payload_locked_documents_rels" USING btree ("speech_cut_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "speech_cut" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "speech_cut" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_speech_cut_fk";
  
  DROP INDEX "payload_locked_documents_rels_speech_cut_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "speech_cut_id";
  DROP TYPE "public"."enum_speech_cut_status";
  DROP TYPE "public"."enum_speech_cut_step";`)
}
