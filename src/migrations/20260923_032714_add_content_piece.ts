import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE TYPE "public"."enum_content_piece_topics" AS ENUM('saude', 'educacao', 'cultura', 'esporte', 'seguranca-publica', 'meio-ambiente', 'economia-trabalho', 'direitos-humanos', 'infraestrutura', 'ciencia-tecnologia', 'politica-instituicoes', 'agricultura', 'habitacao-cidades', 'comunicacao-midia', 'igualdade-racial', 'mulheres-genero', 'juventude', 'pessoa-deficiencia');
  CREATE TYPE "public"."enum_content_piece_curated_fields" AS ENUM('title', 'description', 'topics', 'municipality', 'institution', 'pieceDate', 'transcript', 'type');
  CREATE TYPE "public"."enum_content_piece_type" AS ENUM('video', 'foto', 'texto', 'audio', 'card');
  CREATE TYPE "public"."enum_content_piece_origin" AS ENUM('arquivo', 'instagram', 'youtube');
  CREATE TYPE "public"."enum_content_piece_status" AS ENUM('rascunho', 'publicado');
  CREATE TYPE "public"."enum_content_piece_processing_status" AS ENUM('processando', 'pronto', 'falhou');
  CREATE TYPE "public"."enum_content_piece_step" AS ENUM('extraindo', 'transcrevendo', 'catalogando', 'salvando');
  CREATE TABLE "content_piece_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_content_piece_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "content_piece_curated_fields" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_content_piece_curated_fields",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "content_piece" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"type" "enum_content_piece_type" NOT NULL,
  	"description" varchar,
  	"municipality_id" integer,
  	"city_label" varchar,
  	"region" varchar,
  	"institution" varchar,
  	"piece_date" timestamp(3) with time zone,
  	"duration_seconds" numeric,
  	"transcript" varchar,
  	"media_id" integer,
  	"source_url" varchar,
  	"origin" "enum_content_piece_origin" DEFAULT 'arquivo' NOT NULL,
  	"status" "enum_content_piece_status" DEFAULT 'rascunho' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"processing_status" "enum_content_piece_processing_status" DEFAULT 'pronto' NOT NULL,
  	"step" "enum_content_piece_step",
  	"error" varchar,
  	"search_text" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_media" (
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
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_piece_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_media_id" integer;
  ALTER TABLE "content_piece_topics" ADD CONSTRAINT "content_piece_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_piece"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_piece_curated_fields" ADD CONSTRAINT "content_piece_curated_fields_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_piece"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_piece" ADD CONSTRAINT "content_piece_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_piece" ADD CONSTRAINT "content_piece_media_id_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_piece" ADD CONSTRAINT "content_piece_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "content_piece_topics_order_idx" ON "content_piece_topics" USING btree ("order");
  CREATE INDEX "content_piece_topics_parent_idx" ON "content_piece_topics" USING btree ("parent_id");
  CREATE INDEX "content_piece_topics_value_idx" ON "content_piece_topics" USING btree ("value");
  CREATE INDEX "content_piece_curated_fields_order_idx" ON "content_piece_curated_fields" USING btree ("order");
  CREATE INDEX "content_piece_curated_fields_parent_idx" ON "content_piece_curated_fields" USING btree ("parent_id");
  CREATE UNIQUE INDEX "content_piece_slug_idx" ON "content_piece" USING btree ("slug");
  CREATE INDEX "content_piece_type_idx" ON "content_piece" USING btree ("type");
  CREATE INDEX "content_piece_municipality_idx" ON "content_piece" USING btree ("municipality_id");
  CREATE INDEX "content_piece_piece_date_idx" ON "content_piece" USING btree ("piece_date");
  CREATE INDEX "content_piece_media_idx" ON "content_piece" USING btree ("media_id");
  CREATE UNIQUE INDEX "content_piece_source_url_idx" ON "content_piece" USING btree ("source_url");
  CREATE INDEX "content_piece_status_idx" ON "content_piece" USING btree ("status");
  CREATE INDEX "content_piece_processing_status_idx" ON "content_piece" USING btree ("processing_status");
  CREATE INDEX "content_piece_created_by_idx" ON "content_piece" USING btree ("created_by_id");
  CREATE INDEX "content_piece_updated_at_idx" ON "content_piece" USING btree ("updated_at");
  CREATE INDEX "content_piece_created_at_idx" ON "content_piece" USING btree ("created_at");
  CREATE INDEX "content_media_updated_at_idx" ON "content_media" USING btree ("updated_at");
  CREATE INDEX "content_media_created_at_idx" ON "content_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "content_media_filename_idx" ON "content_media" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_piece_fk" FOREIGN KEY ("content_piece_id") REFERENCES "public"."content_piece"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_media_fk" FOREIGN KEY ("content_media_id") REFERENCES "public"."content_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_content_piece_id_idx" ON "payload_locked_documents_rels" USING btree ("content_piece_id");
  CREATE INDEX "payload_locked_documents_rels_content_media_id_idx" ON "payload_locked_documents_rels" USING btree ("content_media_id");
   CREATE INDEX IF NOT EXISTS "content_piece_search_text_trgm_idx" ON "content_piece" USING gin ("search_text" gin_trgm_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "content_piece_search_text_trgm_idx";
   ALTER TABLE "content_piece_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_piece_curated_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_piece" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "content_piece_topics" CASCADE;
  DROP TABLE "content_piece_curated_fields" CASCADE;
  DROP TABLE "content_piece" CASCADE;
  DROP TABLE "content_media" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_content_piece_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_content_media_fk";
  
  DROP INDEX "payload_locked_documents_rels_content_piece_id_idx";
  DROP INDEX "payload_locked_documents_rels_content_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_piece_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_media_id";
  DROP TYPE "public"."enum_content_piece_topics";
  DROP TYPE "public"."enum_content_piece_curated_fields";
  DROP TYPE "public"."enum_content_piece_type";
  DROP TYPE "public"."enum_content_piece_origin";
  DROP TYPE "public"."enum_content_piece_status";
  DROP TYPE "public"."enum_content_piece_processing_status";
  DROP TYPE "public"."enum_content_piece_step";`)
}
