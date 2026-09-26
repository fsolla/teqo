import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE TYPE "public"."enum_archive_photo_catalog_themes" AS ENUM('saude', 'educacao', 'cultura', 'esporte', 'seguranca-publica', 'meio-ambiente', 'economia-trabalho', 'direitos-humanos', 'infraestrutura', 'ciencia-tecnologia', 'politica-instituicoes', 'agricultura', 'habitacao-cidades', 'comunicacao-midia', 'igualdade-racial', 'mulheres-genero', 'juventude', 'pessoa-deficiencia');
  CREATE TYPE "public"."enum_archive_photo_curated_fields" AS ENUM('alt', 'caption', 'description', 'scene', 'visibleText', 'hasPeople', 'themes', 'people', 'municipality');
  CREATE TYPE "public"."enum_archive_photo_catalog_scene" AS ENUM('plenaria', 'audiencia', 'reuniao', 'evento', 'mobilizacao', 'visita', 'entrevista', 'discurso', 'retrato', 'gabinete', 'outro');
  CREATE TYPE "public"."enum_archive_photo_catalog_source" AS ENUM('ai', 'metadata', 'none');
  CREATE TABLE "archive_photo_catalog_themes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_archive_photo_catalog_themes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "archive_photo_curated_fields" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_archive_photo_curated_fields",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "archive_photo_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_caption" varchar;
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_description" varchar;
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_scene" "enum_archive_photo_catalog_scene";
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_visible_text" varchar;
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_has_people" boolean;
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_municipality_id" integer;
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_source" "enum_archive_photo_catalog_source";
  ALTER TABLE "archive_photo" ADD COLUMN "catalog_cataloged_at" timestamp(3) with time zone;
  ALTER TABLE "archive_photo" ADD COLUMN "taken_on" timestamp(3) with time zone;
  ALTER TABLE "archive_photo" ADD COLUMN "search_text" varchar;
  ALTER TABLE "archive_photo_catalog_themes" ADD CONSTRAINT "archive_photo_catalog_themes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "archive_photo_curated_fields" ADD CONSTRAINT "archive_photo_curated_fields_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "archive_photo_texts" ADD CONSTRAINT "archive_photo_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "archive_photo_catalog_themes_order_idx" ON "archive_photo_catalog_themes" USING btree ("order");
  CREATE INDEX "archive_photo_catalog_themes_parent_idx" ON "archive_photo_catalog_themes" USING btree ("parent_id");
  CREATE INDEX "archive_photo_catalog_themes_value_idx" ON "archive_photo_catalog_themes" USING btree ("value");
  CREATE INDEX "archive_photo_curated_fields_order_idx" ON "archive_photo_curated_fields" USING btree ("order");
  CREATE INDEX "archive_photo_curated_fields_parent_idx" ON "archive_photo_curated_fields" USING btree ("parent_id");
  CREATE INDEX "archive_photo_texts_order_parent" ON "archive_photo_texts" USING btree ("order","parent_id");
  ALTER TABLE "archive_photo" ADD CONSTRAINT "archive_photo_catalog_municipality_id_municipality_id_fk" FOREIGN KEY ("catalog_municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "archive_photo_catalog_catalog_scene_idx" ON "archive_photo" USING btree ("catalog_scene");
  CREATE INDEX "archive_photo_catalog_catalog_municipality_idx" ON "archive_photo" USING btree ("catalog_municipality_id");
  CREATE INDEX "archive_photo_catalog_catalog_cataloged_at_idx" ON "archive_photo" USING btree ("catalog_cataloged_at");
   CREATE INDEX "archive_photo_taken_on_idx" ON "archive_photo" USING btree ("taken_on");
   CREATE INDEX IF NOT EXISTS "archive_photo_search_text_trgm_idx" ON "archive_photo" USING gin ("search_text" gin_trgm_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "archive_photo_search_text_trgm_idx";
   ALTER TABLE "archive_photo_catalog_themes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "archive_photo_curated_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "archive_photo_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "archive_photo_catalog_themes" CASCADE;
  DROP TABLE "archive_photo_curated_fields" CASCADE;
  DROP TABLE "archive_photo_texts" CASCADE;
  ALTER TABLE "archive_photo" DROP CONSTRAINT "archive_photo_catalog_municipality_id_municipality_id_fk";
  
  DROP INDEX "archive_photo_catalog_catalog_scene_idx";
  DROP INDEX "archive_photo_catalog_catalog_municipality_idx";
  DROP INDEX "archive_photo_catalog_catalog_cataloged_at_idx";
  DROP INDEX "archive_photo_taken_on_idx";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_caption";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_description";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_scene";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_visible_text";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_has_people";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_municipality_id";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_source";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_cataloged_at";
  ALTER TABLE "archive_photo" DROP COLUMN "taken_on";
  ALTER TABLE "archive_photo" DROP COLUMN "search_text";
  DROP TYPE "public"."enum_archive_photo_catalog_themes";
  DROP TYPE "public"."enum_archive_photo_curated_fields";
  DROP TYPE "public"."enum_archive_photo_catalog_scene";
  DROP TYPE "public"."enum_archive_photo_catalog_source";`)
}
