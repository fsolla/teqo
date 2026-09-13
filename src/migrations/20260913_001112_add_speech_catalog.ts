import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C153 — speech catalog tables + the `communicator` campaign role.
 *
 * The generated migration also re-emitted
 * `DROP INDEX google_calendar_sync_oauth_connected_at_idx`, a snapshot drift
 * from C149 (the index appears in that migration's JSON but its SQL never
 * created it, so the statement would fail on every environment); it was
 * removed by hand.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_speech_topics" AS ENUM('saude', 'educacao', 'cultura', 'esporte', 'seguranca-publica', 'meio-ambiente', 'economia-trabalho', 'direitos-humanos', 'infraestrutura', 'ciencia-tecnologia', 'politica-instituicoes', 'agricultura', 'habitacao-cidades', 'comunicacao-midia', 'igualdade-racial', 'mulheres-genero', 'juventude', 'pessoa-deficiencia');
  CREATE TYPE "public"."enum_speech_scopes" AS ENUM('bahia', 'brasil', 'internacional');
  CREATE TYPE "public"."enum_speech_legislature" AS ENUM('54', '55', '56', '57');
  CREATE TYPE "public"."enum_speech_classified_by" AS ENUM('gazetteer', 'llm', 'manual');
  ALTER TYPE "public"."enum_campaign_user_role" ADD VALUE 'communicator' BEFORE 'leader';
  CREATE TABLE "speech_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_speech_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "speech_scopes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_speech_scopes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "speech" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_key" varchar NOT NULL,
  	"speech_at" varchar NOT NULL,
  	"year" numeric,
  	"legislature" "enum_speech_legislature",
  	"type" varchar,
  	"phase" varchar,
  	"duration_seconds" numeric,
  	"summary" varchar,
  	"official_transcript" varchar,
  	"official_text_url" varchar,
  	"event_id" numeric,
  	"event_type" varchar,
  	"event_start_at" varchar,
  	"event_end_at" varchar,
  	"youtube_url" varchar,
  	"presiding_officer" varchar,
  	"audio_id" numeric,
  	"excerpt_t_ms" numeric,
  	"vod_playback_url" varchar,
  	"vod_download_url" varchar,
  	"classified_by" "enum_speech_classified_by" DEFAULT 'gazetteer' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "speech_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "speech_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"municipality_id" integer
  );
  
  CREATE TABLE "speech_segment" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"speech_id" integer NOT NULL,
  	"order" numeric NOT NULL,
  	"start_seconds" numeric NOT NULL,
  	"end_seconds" numeric NOT NULL,
  	"text" varchar NOT NULL,
  	"search_text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speech_id" integer;  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speech_segment_id" integer;
  ALTER TABLE "speech_topics" ADD CONSTRAINT "speech_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speech"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speech_scopes" ADD CONSTRAINT "speech_scopes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speech"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speech_texts" ADD CONSTRAINT "speech_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speech"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speech_rels" ADD CONSTRAINT "speech_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."speech"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speech_rels" ADD CONSTRAINT "speech_rels_municipality_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "speech_segment" ADD CONSTRAINT "speech_segment_speech_id_speech_id_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speech"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "speech_topics_order_idx" ON "speech_topics" USING btree ("order");
  CREATE INDEX "speech_topics_parent_idx" ON "speech_topics" USING btree ("parent_id");
  CREATE INDEX "speech_topics_value_idx" ON "speech_topics" USING btree ("value");
  CREATE INDEX "speech_scopes_order_idx" ON "speech_scopes" USING btree ("order");
  CREATE INDEX "speech_scopes_parent_idx" ON "speech_scopes" USING btree ("parent_id");
  CREATE INDEX "speech_scopes_value_idx" ON "speech_scopes" USING btree ("value");
  CREATE UNIQUE INDEX "speech_source_key_idx" ON "speech" USING btree ("source_key");
  CREATE INDEX "speech_speech_at_idx" ON "speech" USING btree ("speech_at");
  CREATE INDEX "speech_year_idx" ON "speech" USING btree ("year");
  CREATE INDEX "speech_legislature_idx" ON "speech" USING btree ("legislature");
  CREATE INDEX "speech_phase_idx" ON "speech" USING btree ("phase");
  CREATE INDEX "speech_event_id_idx" ON "speech" USING btree ("event_id");
  CREATE INDEX "speech_audio_id_idx" ON "speech" USING btree ("audio_id");
  CREATE INDEX "speech_excerpt_t_ms_idx" ON "speech" USING btree ("excerpt_t_ms");
  CREATE INDEX "speech_classified_by_idx" ON "speech" USING btree ("classified_by");
  CREATE INDEX "speech_updated_at_idx" ON "speech" USING btree ("updated_at");
  CREATE INDEX "speech_created_at_idx" ON "speech" USING btree ("created_at");
  CREATE INDEX "speech_texts_order_parent" ON "speech_texts" USING btree ("order","parent_id");
  CREATE INDEX "speech_rels_order_idx" ON "speech_rels" USING btree ("order");
  CREATE INDEX "speech_rels_parent_idx" ON "speech_rels" USING btree ("parent_id");
  CREATE INDEX "speech_rels_path_idx" ON "speech_rels" USING btree ("path");
  CREATE INDEX "speech_rels_municipality_id_idx" ON "speech_rels" USING btree ("municipality_id");
  CREATE INDEX "speech_segment_speech_idx" ON "speech_segment" USING btree ("speech_id");
  CREATE INDEX "speech_segment_updated_at_idx" ON "speech_segment" USING btree ("updated_at");
  CREATE INDEX "speech_segment_created_at_idx" ON "speech_segment" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speech_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speech"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speech_segment_fk" FOREIGN KEY ("speech_segment_id") REFERENCES "public"."speech_segment"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_speech_id_idx" ON "payload_locked_documents_rels" USING btree ("speech_id");
  CREATE INDEX "payload_locked_documents_rels_speech_segment_id_idx" ON "payload_locked_documents_rels" USING btree ("speech_segment_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "speech_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "speech_scopes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "speech" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "speech_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "speech_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "speech_segment" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "speech_topics" CASCADE;
  DROP TABLE "speech_scopes" CASCADE;
  DROP TABLE "speech" CASCADE;
  DROP TABLE "speech_texts" CASCADE;
  DROP TABLE "speech_rels" CASCADE;
  DROP TABLE "speech_segment" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_speech_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_speech_segment_fk";
  
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'leader'::text;
  DROP TYPE "public"."enum_campaign_user_role";
  CREATE TYPE "public"."enum_campaign_user_role" AS ENUM('coordinator', 'advisor', 'candidate', 'leader');
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'leader'::"public"."enum_campaign_user_role";
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE "public"."enum_campaign_user_role" USING "role"::"public"."enum_campaign_user_role";
  DROP INDEX "payload_locked_documents_rels_speech_id_idx";
  DROP INDEX "payload_locked_documents_rels_speech_segment_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "speech_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "speech_segment_id";
  DROP TYPE "public"."enum_speech_topics";
  DROP TYPE "public"."enum_speech_scopes";
  DROP TYPE "public"."enum_speech_legislature";
  DROP TYPE "public"."enum_speech_classified_by";`)
}
