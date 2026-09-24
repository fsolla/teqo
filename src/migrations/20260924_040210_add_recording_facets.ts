import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C219 — facet + provenance columns of the uploaded recordings, mirroring the
 * speech catalog (C153): `year` derived from the informed recording date,
 * `topics`/`scopes` enums, `classifiedBy` (nullable: a row from before C219 was
 * never classified) and the `mentionedMunicipalities` join. Additive only.
 *
 * The `year` backfill is deterministic SQL (never an LLM pass in a migration):
 * it derives exactly what the `deriveRecordingYear` hook derives on the next
 * write, so old rows join the "Ano" facet before the classification CLI runs.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_recording_topics" AS ENUM('saude', 'educacao', 'cultura', 'esporte', 'seguranca-publica', 'meio-ambiente', 'economia-trabalho', 'direitos-humanos', 'infraestrutura', 'ciencia-tecnologia', 'politica-instituicoes', 'agricultura', 'habitacao-cidades', 'comunicacao-midia', 'igualdade-racial', 'mulheres-genero', 'juventude', 'pessoa-deficiencia');
  CREATE TYPE "public"."enum_recording_scopes" AS ENUM('bahia', 'brasil', 'internacional');
  CREATE TYPE "public"."enum_recording_classified_by" AS ENUM('gazetteer', 'llm', 'manual');
  CREATE TABLE "recording_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_recording_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "recording_scopes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_recording_scopes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "recording_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"municipality_id" integer
  );
  
  ALTER TABLE "recording" ADD COLUMN "year" numeric;
  ALTER TABLE "recording" ADD COLUMN "classified_by" "enum_recording_classified_by";
  ALTER TABLE "recording_topics" ADD CONSTRAINT "recording_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recording_scopes" ADD CONSTRAINT "recording_scopes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recording_rels" ADD CONSTRAINT "recording_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recording_rels" ADD CONSTRAINT "recording_rels_municipality_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "recording_topics_order_idx" ON "recording_topics" USING btree ("order");
  CREATE INDEX "recording_topics_parent_idx" ON "recording_topics" USING btree ("parent_id");
  CREATE INDEX "recording_topics_value_idx" ON "recording_topics" USING btree ("value");
  CREATE INDEX "recording_scopes_order_idx" ON "recording_scopes" USING btree ("order");
  CREATE INDEX "recording_scopes_parent_idx" ON "recording_scopes" USING btree ("parent_id");
  CREATE INDEX "recording_scopes_value_idx" ON "recording_scopes" USING btree ("value");
  CREATE INDEX "recording_rels_order_idx" ON "recording_rels" USING btree ("order");
  CREATE INDEX "recording_rels_parent_idx" ON "recording_rels" USING btree ("parent_id");
  CREATE INDEX "recording_rels_path_idx" ON "recording_rels" USING btree ("path");
  CREATE INDEX "recording_rels_municipality_id_idx" ON "recording_rels" USING btree ("municipality_id");
   CREATE INDEX "recording_year_idx" ON "recording" USING btree ("year");
   CREATE INDEX "recording_classified_by_idx" ON "recording" USING btree ("classified_by");
   UPDATE "recording" SET "year" = EXTRACT(YEAR FROM "recorded_at") WHERE "recorded_at" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recording_topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "recording_scopes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "recording_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "recording_topics" CASCADE;
  DROP TABLE "recording_scopes" CASCADE;
  DROP TABLE "recording_rels" CASCADE;
  DROP INDEX "recording_year_idx";
  DROP INDEX "recording_classified_by_idx";
  ALTER TABLE "recording" DROP COLUMN "year";
  ALTER TABLE "recording" DROP COLUMN "classified_by";
  DROP TYPE "public"."enum_recording_topics";
  DROP TYPE "public"."enum_recording_scopes";
  DROP TYPE "public"."enum_recording_classified_by";`)
}
