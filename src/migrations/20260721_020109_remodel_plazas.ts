import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import { plazaCatalog } from '../lib/plazaCatalog'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Praça remodel is a deliberate RESET of the campaign vertical (product
  // decision 2026-07-20, docs/plans/remodelagem-pracas.md): campaign rows are
  // wiped before the schema swap so NOT NULL / UNIQUE additions below apply
  // cleanly. campaignUser accounts and all public-site collections are kept.
  await db.execute(sql`
  DELETE FROM "campaign_invite";
  DELETE FROM "supporter";
  DELETE FROM "supporter_import_batch";
  DELETE FROM "action_plan";
  DELETE FROM "leadership";`)

  await db.execute(sql`
   CREATE TYPE "public"."enum_plaza_kind" AS ENUM('municipio', 'zona');
  CREATE TYPE "public"."enum_plaza_priority" AS ENUM('alta', 'normal');
  CREATE TYPE "public"."enum_plaza_political_trend_status" AS ENUM('favoravel', 'neutra', 'desfavoravel');
  CREATE TYPE "public"."enum_organization_kind" AS ENUM('sindicato', 'associacao', 'religioso', 'movimento', 'categoria_profissional', 'outro');
  CREATE TYPE "public"."enum_campaign_demand_status_history_status" AS ENUM('aberta', 'em_analise', 'escalada', 'aprovada', 'rejeitada');
  CREATE TYPE "public"."enum_campaign_demand_kind" AS ENUM('material', 'servico', 'transporte', 'alimentacao', 'infraestrutura', 'espaco', 'equipamento', 'pessoal_apoio', 'outro');
  CREATE TYPE "public"."enum_campaign_demand_status" AS ENUM('aberta', 'em_analise', 'escalada', 'aprovada', 'rejeitada');
  CREATE TYPE "public"."enum_plaza_update_kind" AS ENUM('semanal', 'urgente', 'nota');
  CREATE TABLE "plaza_strengths" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "plaza_risks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "plaza" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_plaza_kind" NOT NULL,
  	"city" varchar NOT NULL,
  	"region" varchar NOT NULL,
  	"ibge_code" varchar NOT NULL,
  	"tse_city_code" varchar NOT NULL,
  	"zone_number" numeric,
  	"priority" "enum_plaza_priority" DEFAULT 'normal',
  	"vote_goals_good" numeric,
  	"vote_goals_regular" numeric,
  	"vote_goals_minimum" numeric,
  	"political_trend_status" "enum_plaza_political_trend_status",
  	"political_trend_note" varchar,
  	"political_trend_recorded_by_id" integer,
  	"political_trend_recorded_at" timestamp(3) with time zone,
  	"dobradinha_notes" varchar,
  	"next_steps" varchar,
  	"last_update_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plaza_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaign_user_id" integer
  );
  
  CREATE TABLE "leadership_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plaza_id" integer,
  	"organization_id" integer
  );
  
  CREATE TABLE "organization" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_organization_kind" NOT NULL,
  	"notes" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "organization_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plaza_id" integer
  );
  
  CREATE TABLE "vote_pledge" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"leadership_id" integer NOT NULL,
  	"plaza_id" integer NOT NULL,
  	"declared_votes" numeric NOT NULL,
  	"declared_at" timestamp(3) with time zone,
  	"declared_by_id" integer,
  	"estimated_votes" numeric,
  	"estimate_note" varchar,
  	"estimated_by_id" integer,
  	"estimated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaign_demand_status_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "enum_campaign_demand_status_history_status" NOT NULL,
  	"note" varchar,
  	"author_id" integer,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "campaign_demand" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_campaign_demand_kind" NOT NULL,
  	"description" varchar,
  	"plaza_id" integer NOT NULL,
  	"action_plan_id" integer,
  	"leadership_id" integer,
  	"status" "enum_campaign_demand_status" DEFAULT 'aberta' NOT NULL,
  	"decision_note" varchar,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"cost" numeric,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaign_demand_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "plaza_update" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"plaza_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"kind" "enum_plaza_update_kind" DEFAULT 'semanal' NOT NULL,
  	"worked" varchar,
  	"failed" varchar,
  	"needs" varchar,
  	"active_volunteers" numeric,
  	"new_supports" numeric,
  	"body" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "electoral_nucleus_tse_zones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_voter_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_strengths" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_risks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "nucleus_update" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "action_plan_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "electoral_nucleus_tse_zones" CASCADE;
  DROP TABLE "electoral_nucleus_voter_profiles" CASCADE;
  DROP TABLE "electoral_nucleus_strengths" CASCADE;
  DROP TABLE "electoral_nucleus_risks" CASCADE;
  DROP TABLE "electoral_nucleus" CASCADE;
  DROP TABLE "electoral_nucleus_texts" CASCADE;
  DROP TABLE "electoral_nucleus_rels" CASCADE;
  DROP TABLE "nucleus_update" CASCADE;
  DROP TABLE "action_plan_texts" CASCADE;
  ALTER TABLE "leadership" DROP CONSTRAINT IF EXISTS "leadership_nucleus_id_electoral_nucleus_id_fk";
  
  ALTER TABLE "supporter" DROP CONSTRAINT IF EXISTS "supporter_nucleus_id_electoral_nucleus_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_electoral_nucleus_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_nucleus_update_fk";
  
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'leader'::text;
  UPDATE "campaign_user" SET "role" = CASE "role"
    WHEN 'geral' THEN 'coordinator'
    WHEN 'coordenador' THEN 'advisor'
    WHEN 'lideranca' THEN 'leader'
    ELSE "role"
  END;
  DROP TYPE "public"."enum_campaign_user_role";
  CREATE TYPE "public"."enum_campaign_user_role" AS ENUM('coordinator', 'advisor', 'leader');
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'leader'::"public"."enum_campaign_user_role";
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE "public"."enum_campaign_user_role" USING "role"::"public"."enum_campaign_user_role";
  DROP INDEX "leadership_nucleus_idx";
  DROP INDEX "contact_nucleus_idx";
  DROP INDEX "supporter_nucleus_idx";
  DROP INDEX "payload_locked_documents_rels_electoral_nucleus_id_idx";
  DROP INDEX "payload_locked_documents_rels_nucleus_update_id_idx";
  DROP INDEX "leadership_contact_idx";
  ALTER TABLE "supporter" ADD COLUMN "plaza_id" integer;
  ALTER TABLE "action_plan" ADD COLUMN "deputy_present" boolean DEFAULT false;
  ALTER TABLE "action_plan" ADD COLUMN "plaza_id" integer NOT NULL;
  ALTER TABLE "action_plan" ADD COLUMN "result_summary" varchar;
  ALTER TABLE "action_plan" ADD COLUMN "result_recorded_by_id" integer;
  ALTER TABLE "action_plan" ADD COLUMN "result_recorded_at" timestamp(3) with time zone;
  ALTER TABLE "action_plan_rels" ADD COLUMN "organization_id" integer;
  ALTER TABLE "action_plan_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plaza_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "organization_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vote_pledge_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_demand_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plaza_update_id" integer;
  ALTER TABLE "plaza_strengths" ADD CONSTRAINT "plaza_strengths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plaza_risks" ADD CONSTRAINT "plaza_risks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plaza" ADD CONSTRAINT "plaza_political_trend_recorded_by_id_campaign_user_id_fk" FOREIGN KEY ("political_trend_recorded_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plaza_rels" ADD CONSTRAINT "plaza_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plaza_rels" ADD CONSTRAINT "plaza_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leadership_rels" ADD CONSTRAINT "leadership_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."leadership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leadership_rels" ADD CONSTRAINT "leadership_rels_plaza_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leadership_rels" ADD CONSTRAINT "leadership_rels_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "organization_rels" ADD CONSTRAINT "organization_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organization_rels" ADD CONSTRAINT "organization_rels_plaza_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vote_pledge" ADD CONSTRAINT "vote_pledge_leadership_id_leadership_id_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vote_pledge" ADD CONSTRAINT "vote_pledge_plaza_id_plaza_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vote_pledge" ADD CONSTRAINT "vote_pledge_declared_by_id_campaign_user_id_fk" FOREIGN KEY ("declared_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vote_pledge" ADD CONSTRAINT "vote_pledge_estimated_by_id_campaign_user_id_fk" FOREIGN KEY ("estimated_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand_status_history" ADD CONSTRAINT "campaign_demand_status_history_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand_status_history" ADD CONSTRAINT "campaign_demand_status_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_demand"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_demand" ADD CONSTRAINT "campaign_demand_plaza_id_plaza_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand" ADD CONSTRAINT "campaign_demand_action_plan_id_action_plan_id_fk" FOREIGN KEY ("action_plan_id") REFERENCES "public"."action_plan"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand" ADD CONSTRAINT "campaign_demand_leadership_id_leadership_id_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand" ADD CONSTRAINT "campaign_demand_decided_by_id_campaign_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand" ADD CONSTRAINT "campaign_demand_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_demand_rels" ADD CONSTRAINT "campaign_demand_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."campaign_demand"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_demand_rels" ADD CONSTRAINT "campaign_demand_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plaza_update" ADD CONSTRAINT "plaza_update_plaza_id_plaza_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plaza_update" ADD CONSTRAINT "plaza_update_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "plaza_strengths_order_idx" ON "plaza_strengths" USING btree ("_order");
  CREATE INDEX "plaza_strengths_parent_id_idx" ON "plaza_strengths" USING btree ("_parent_id");
  CREATE INDEX "plaza_risks_order_idx" ON "plaza_risks" USING btree ("_order");
  CREATE INDEX "plaza_risks_parent_id_idx" ON "plaza_risks" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "plaza_name_idx" ON "plaza" USING btree ("name");
  CREATE UNIQUE INDEX "plaza_slug_idx" ON "plaza" USING btree ("slug");
  CREATE INDEX "plaza_kind_idx" ON "plaza" USING btree ("kind");
  CREATE INDEX "plaza_city_idx" ON "plaza" USING btree ("city");
  CREATE INDEX "plaza_region_idx" ON "plaza" USING btree ("region");
  CREATE INDEX "plaza_ibge_code_idx" ON "plaza" USING btree ("ibge_code");
  CREATE INDEX "plaza_tse_city_code_idx" ON "plaza" USING btree ("tse_city_code");
  CREATE INDEX "plaza_zone_number_idx" ON "plaza" USING btree ("zone_number");
  CREATE INDEX "plaza_priority_idx" ON "plaza" USING btree ("priority");
  CREATE INDEX "plaza_political_trend_political_trend_recorded_by_idx" ON "plaza" USING btree ("political_trend_recorded_by_id");
  CREATE INDEX "plaza_last_update_at_idx" ON "plaza" USING btree ("last_update_at");
  CREATE INDEX "plaza_updated_at_idx" ON "plaza" USING btree ("updated_at");
  CREATE INDEX "plaza_created_at_idx" ON "plaza" USING btree ("created_at");
  CREATE INDEX "plaza_rels_order_idx" ON "plaza_rels" USING btree ("order");
  CREATE INDEX "plaza_rels_parent_idx" ON "plaza_rels" USING btree ("parent_id");
  CREATE INDEX "plaza_rels_path_idx" ON "plaza_rels" USING btree ("path");
  CREATE INDEX "plaza_rels_campaign_user_id_idx" ON "plaza_rels" USING btree ("campaign_user_id");
  CREATE INDEX "leadership_rels_order_idx" ON "leadership_rels" USING btree ("order");
  CREATE INDEX "leadership_rels_parent_idx" ON "leadership_rels" USING btree ("parent_id");
  CREATE INDEX "leadership_rels_path_idx" ON "leadership_rels" USING btree ("path");
  CREATE INDEX "leadership_rels_plaza_id_idx" ON "leadership_rels" USING btree ("plaza_id");
  CREATE INDEX "leadership_rels_organization_id_idx" ON "leadership_rels" USING btree ("organization_id");
  CREATE UNIQUE INDEX "organization_name_idx" ON "organization" USING btree ("name");
  CREATE UNIQUE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");
  CREATE INDEX "organization_kind_idx" ON "organization" USING btree ("kind");
  CREATE INDEX "organization_created_by_idx" ON "organization" USING btree ("created_by_id");
  CREATE INDEX "organization_updated_at_idx" ON "organization" USING btree ("updated_at");
  CREATE INDEX "organization_created_at_idx" ON "organization" USING btree ("created_at");
  CREATE INDEX "organization_rels_order_idx" ON "organization_rels" USING btree ("order");
  CREATE INDEX "organization_rels_parent_idx" ON "organization_rels" USING btree ("parent_id");
  CREATE INDEX "organization_rels_path_idx" ON "organization_rels" USING btree ("path");
  CREATE INDEX "organization_rels_plaza_id_idx" ON "organization_rels" USING btree ("plaza_id");
  CREATE INDEX "vote_pledge_leadership_idx" ON "vote_pledge" USING btree ("leadership_id");
  CREATE INDEX "vote_pledge_plaza_idx" ON "vote_pledge" USING btree ("plaza_id");
  CREATE INDEX "vote_pledge_declared_votes_idx" ON "vote_pledge" USING btree ("declared_votes");
  CREATE INDEX "vote_pledge_declared_by_idx" ON "vote_pledge" USING btree ("declared_by_id");
  CREATE INDEX "vote_pledge_estimated_votes_idx" ON "vote_pledge" USING btree ("estimated_votes");
  CREATE INDEX "vote_pledge_estimated_by_idx" ON "vote_pledge" USING btree ("estimated_by_id");
  CREATE INDEX "vote_pledge_updated_at_idx" ON "vote_pledge" USING btree ("updated_at");
  CREATE INDEX "vote_pledge_created_at_idx" ON "vote_pledge" USING btree ("created_at");
  CREATE UNIQUE INDEX "leadership_plaza_idx" ON "vote_pledge" USING btree ("leadership_id","plaza_id");
  CREATE INDEX "campaign_demand_status_history_order_idx" ON "campaign_demand_status_history" USING btree ("_order");
  CREATE INDEX "campaign_demand_status_history_parent_id_idx" ON "campaign_demand_status_history" USING btree ("_parent_id");
  CREATE INDEX "campaign_demand_status_history_author_idx" ON "campaign_demand_status_history" USING btree ("author_id");
  CREATE INDEX "campaign_demand_title_idx" ON "campaign_demand" USING btree ("title");
  CREATE UNIQUE INDEX "campaign_demand_slug_idx" ON "campaign_demand" USING btree ("slug");
  CREATE INDEX "campaign_demand_kind_idx" ON "campaign_demand" USING btree ("kind");
  CREATE INDEX "campaign_demand_plaza_idx" ON "campaign_demand" USING btree ("plaza_id");
  CREATE INDEX "campaign_demand_action_plan_idx" ON "campaign_demand" USING btree ("action_plan_id");
  CREATE INDEX "campaign_demand_leadership_idx" ON "campaign_demand" USING btree ("leadership_id");
  CREATE INDEX "campaign_demand_status_idx" ON "campaign_demand" USING btree ("status");
  CREATE INDEX "campaign_demand_decided_by_idx" ON "campaign_demand" USING btree ("decided_by_id");
  CREATE INDEX "campaign_demand_created_by_idx" ON "campaign_demand" USING btree ("created_by_id");
  CREATE INDEX "campaign_demand_updated_at_idx" ON "campaign_demand" USING btree ("updated_at");
  CREATE INDEX "campaign_demand_created_at_idx" ON "campaign_demand" USING btree ("created_at");
  CREATE INDEX "campaign_demand_rels_order_idx" ON "campaign_demand_rels" USING btree ("order");
  CREATE INDEX "campaign_demand_rels_parent_idx" ON "campaign_demand_rels" USING btree ("parent_id");
  CREATE INDEX "campaign_demand_rels_path_idx" ON "campaign_demand_rels" USING btree ("path");
  CREATE INDEX "campaign_demand_rels_media_id_idx" ON "campaign_demand_rels" USING btree ("media_id");
  CREATE INDEX "plaza_update_plaza_idx" ON "plaza_update" USING btree ("plaza_id");
  CREATE INDEX "plaza_update_author_idx" ON "plaza_update" USING btree ("author_id");
  CREATE INDEX "plaza_update_kind_idx" ON "plaza_update" USING btree ("kind");
  CREATE INDEX "plaza_update_updated_at_idx" ON "plaza_update" USING btree ("updated_at");
  CREATE INDEX "plaza_update_created_at_idx" ON "plaza_update" USING btree ("created_at");
  ALTER TABLE "supporter" ADD CONSTRAINT "supporter_plaza_id_plaza_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_plaza_id_plaza_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_result_recorded_by_id_campaign_user_id_fk" FOREIGN KEY ("result_recorded_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan_rels" ADD CONSTRAINT "action_plan_rels_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "action_plan_rels" ADD CONSTRAINT "action_plan_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plaza_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."plaza"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vote_pledge_fk" FOREIGN KEY ("vote_pledge_id") REFERENCES "public"."vote_pledge"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_demand_fk" FOREIGN KEY ("campaign_demand_id") REFERENCES "public"."campaign_demand"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plaza_update_fk" FOREIGN KEY ("plaza_update_id") REFERENCES "public"."plaza_update"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "supporter_plaza_idx" ON "supporter" USING btree ("plaza_id");
  CREATE INDEX "action_plan_deputy_present_idx" ON "action_plan" USING btree ("deputy_present");
  CREATE INDEX "action_plan_plaza_idx" ON "action_plan" USING btree ("plaza_id");
  CREATE INDEX "action_plan_result_recorded_by_idx" ON "action_plan" USING btree ("result_recorded_by_id");
  CREATE INDEX "action_plan_rels_organization_id_idx" ON "action_plan_rels" USING btree ("organization_id");
  CREATE INDEX "action_plan_rels_media_id_idx" ON "action_plan_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_plaza_id_idx" ON "payload_locked_documents_rels" USING btree ("plaza_id");
  CREATE INDEX "payload_locked_documents_rels_organization_id_idx" ON "payload_locked_documents_rels" USING btree ("organization_id");
  CREATE INDEX "payload_locked_documents_rels_vote_pledge_id_idx" ON "payload_locked_documents_rels" USING btree ("vote_pledge_id");
  CREATE INDEX "payload_locked_documents_rels_campaign_demand_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_demand_id");
  CREATE INDEX "payload_locked_documents_rels_plaza_update_id_idx" ON "payload_locked_documents_rels" USING btree ("plaza_update_id");
  CREATE UNIQUE INDEX "leadership_contact_idx" ON "leadership" USING btree ("contact_id");
  ALTER TABLE "leadership" DROP COLUMN "nucleus_id";
  ALTER TABLE "supporter" DROP COLUMN "nucleus_id";
  ALTER TABLE "action_plan" DROP COLUMN "territory_notes";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "electoral_nucleus_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "nucleus_update_id";
  DROP TYPE "public"."enum_electoral_nucleus_status";
  DROP TYPE "public"."enum_electoral_nucleus_organization_kind";
  DROP TYPE "public"."enum_electoral_nucleus_sector_kind";
  DROP TYPE "public"."enum_nucleus_update_kind";`)

  // Supporter uniqueness moves from (contact, nucleus) to (contact, plaza).
  // NULLS NOT DISTINCT (Postgres >= 15) keeps "same contact without plaza"
  // unique too — mirrors migration 20260718_222656_add_supporter.
  await db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "supporter_contact_plaza_nulls_not_distinct_idx"
    ON "supporter" ("contact_id", "plaza_id") NULLS NOT DISTINCT;`)

  // Seed the 436 predefined Praças from the static catalog (identity is
  // guarded by tests/fixtures/plaza-catalog.snapshot.json).
  const values = plazaCatalog.map(
    (entry) =>
      sql`(${entry.name}, ${entry.slug}, ${entry.kind}::"public"."enum_plaza_kind", ${entry.city}, ${entry.region}, ${entry.ibgeCode}, ${entry.tseCityCode}, ${entry.zoneNumber ?? null})`,
  )
  await db.execute(sql`
  INSERT INTO "plaza" ("name", "slug", "kind", "city", "region", "ibge_code", "tse_city_code", "zone_number")
  VALUES ${sql.join(values, sql`, `)}
  ON CONFLICT ("slug") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_electoral_nucleus_status" AS ENUM('ativo', 'arquivado');
  CREATE TYPE "public"."enum_electoral_nucleus_organization_kind" AS ENUM('territorial', 'associacao', 'sindicato', 'religioso', 'movimento', 'categoria_profissional', 'outro');
  CREATE TYPE "public"."enum_electoral_nucleus_sector_kind" AS ENUM('rural', 'religioso', 'sindical', 'empresarial', 'juventude', 'saude', 'educacao', 'cultura', 'outro');
  CREATE TYPE "public"."enum_nucleus_update_kind" AS ENUM('semanal', 'urgente', 'nota');
  CREATE TABLE "electoral_nucleus_tse_zones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"zone_number" numeric NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "electoral_nucleus_voter_profiles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"age_range" varchar,
  	"income_band" varchar,
  	"occupation" varchar,
  	"local_traits" varchar,
  	"notes" varchar
  );
  
  CREATE TABLE "electoral_nucleus_strengths" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "electoral_nucleus_risks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "electoral_nucleus" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_electoral_nucleus_status" DEFAULT 'ativo' NOT NULL,
  	"locality" varchar,
  	"territory_notes" varchar,
  	"organization_kind" "enum_electoral_nucleus_organization_kind" DEFAULT 'territorial' NOT NULL,
  	"organization_label" varchar,
  	"sector_kind" "enum_electoral_nucleus_sector_kind",
  	"primary_contact_id" integer,
  	"confirmed_vote_estimate" numeric,
  	"confirmed_vote_estimate_at" timestamp(3) with time zone,
  	"confirmed_vote_estimate_by_id" integer,
  	"confirmation_note" varchar,
  	"proposed_vote_estimate" numeric,
  	"proposed_vote_estimate_at" timestamp(3) with time zone,
  	"proposed_vote_estimate_by_id" integer,
  	"proposed_vote_estimate_version" varchar,
  	"ticket_alliance_partner_name" varchar,
  	"ticket_alliance_office" varchar,
  	"ticket_alliance_is_campaign_partner" boolean DEFAULT false,
  	"ticket_alliance_notes" varchar,
  	"last_update_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "electoral_nucleus_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "electoral_nucleus_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaign_user_id" integer
  );
  
  CREATE TABLE "nucleus_update" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nucleus_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"kind" "enum_nucleus_update_kind" DEFAULT 'semanal' NOT NULL,
  	"worked" varchar,
  	"failed" varchar,
  	"needs" varchar,
  	"active_volunteers" numeric,
  	"new_supports" numeric,
  	"body" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "action_plan_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "plaza_strengths" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plaza_risks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plaza" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plaza_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "leadership_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "organization" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "organization_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vote_pledge" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_demand_status_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_demand" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_demand_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plaza_update" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "plaza_strengths" CASCADE;
  DROP TABLE "plaza_risks" CASCADE;
  DROP TABLE "plaza" CASCADE;
  DROP TABLE "plaza_rels" CASCADE;
  DROP TABLE "leadership_rels" CASCADE;
  DROP TABLE "organization" CASCADE;
  DROP TABLE "organization_rels" CASCADE;
  DROP TABLE "vote_pledge" CASCADE;
  DROP TABLE "campaign_demand_status_history" CASCADE;
  DROP TABLE "campaign_demand" CASCADE;
  DROP TABLE "campaign_demand_rels" CASCADE;
  DROP TABLE "plaza_update" CASCADE;
  ALTER TABLE "supporter" DROP CONSTRAINT IF EXISTS "supporter_plaza_id_plaza_id_fk";
  
  ALTER TABLE "action_plan" DROP CONSTRAINT IF EXISTS "action_plan_plaza_id_plaza_id_fk";
  
  ALTER TABLE "action_plan" DROP CONSTRAINT IF EXISTS "action_plan_result_recorded_by_id_campaign_user_id_fk";
  
  ALTER TABLE "action_plan_rels" DROP CONSTRAINT IF EXISTS "action_plan_rels_organization_fk";
  
  ALTER TABLE "action_plan_rels" DROP CONSTRAINT IF EXISTS "action_plan_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plaza_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_organization_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_vote_pledge_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_demand_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plaza_update_fk";
  
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'lideranca'::text;
  UPDATE "campaign_user" SET "role" = CASE "role"
    WHEN 'coordinator' THEN 'geral'
    WHEN 'advisor' THEN 'coordenador'
    WHEN 'leader' THEN 'lideranca'
    ELSE "role"
  END;
  DROP TYPE "public"."enum_campaign_user_role";
  CREATE TYPE "public"."enum_campaign_user_role" AS ENUM('geral', 'coordenador', 'lideranca');
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DEFAULT 'lideranca'::"public"."enum_campaign_user_role";
  ALTER TABLE "campaign_user" ALTER COLUMN "role" SET DATA TYPE "public"."enum_campaign_user_role" USING "role"::"public"."enum_campaign_user_role";
  DROP INDEX "supporter_plaza_idx";
  DROP INDEX "action_plan_deputy_present_idx";
  DROP INDEX "action_plan_plaza_idx";
  DROP INDEX "action_plan_result_recorded_by_idx";
  DROP INDEX "action_plan_rels_organization_id_idx";
  DROP INDEX "action_plan_rels_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_plaza_id_idx";
  DROP INDEX "payload_locked_documents_rels_organization_id_idx";
  DROP INDEX "payload_locked_documents_rels_vote_pledge_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaign_demand_id_idx";
  DROP INDEX "payload_locked_documents_rels_plaza_update_id_idx";
  DROP INDEX "leadership_contact_idx";
  ALTER TABLE "leadership" ADD COLUMN "nucleus_id" integer NOT NULL;
  ALTER TABLE "supporter" ADD COLUMN "nucleus_id" integer;
  ALTER TABLE "action_plan" ADD COLUMN "territory_notes" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "electoral_nucleus_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "nucleus_update_id" integer;
  ALTER TABLE "electoral_nucleus_tse_zones" ADD CONSTRAINT "electoral_nucleus_tse_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_voter_profiles" ADD CONSTRAINT "electoral_nucleus_voter_profiles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_strengths" ADD CONSTRAINT "electoral_nucleus_strengths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_risks" ADD CONSTRAINT "electoral_nucleus_risks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_primary_contact_id_contact_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_confirmed_vote_estimate_by_id_campaign_user_id_fk" FOREIGN KEY ("confirmed_vote_estimate_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_proposed_vote_estimate_by_id_campaign_user_id_fk" FOREIGN KEY ("proposed_vote_estimate_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_texts" ADD CONSTRAINT "electoral_nucleus_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_rels" ADD CONSTRAINT "electoral_nucleus_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_rels" ADD CONSTRAINT "electoral_nucleus_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nucleus_update" ADD CONSTRAINT "nucleus_update_nucleus_id_electoral_nucleus_id_fk" FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nucleus_update" ADD CONSTRAINT "nucleus_update_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan_texts" ADD CONSTRAINT "action_plan_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "electoral_nucleus_tse_zones_order_idx" ON "electoral_nucleus_tse_zones" USING btree ("_order");
  CREATE INDEX "electoral_nucleus_tse_zones_parent_id_idx" ON "electoral_nucleus_tse_zones" USING btree ("_parent_id");
  CREATE INDEX "electoral_nucleus_voter_profiles_order_idx" ON "electoral_nucleus_voter_profiles" USING btree ("_order");
  CREATE INDEX "electoral_nucleus_voter_profiles_parent_id_idx" ON "electoral_nucleus_voter_profiles" USING btree ("_parent_id");
  CREATE INDEX "electoral_nucleus_strengths_order_idx" ON "electoral_nucleus_strengths" USING btree ("_order");
  CREATE INDEX "electoral_nucleus_strengths_parent_id_idx" ON "electoral_nucleus_strengths" USING btree ("_parent_id");
  CREATE INDEX "electoral_nucleus_risks_order_idx" ON "electoral_nucleus_risks" USING btree ("_order");
  CREATE INDEX "electoral_nucleus_risks_parent_id_idx" ON "electoral_nucleus_risks" USING btree ("_parent_id");
  CREATE INDEX "electoral_nucleus_name_idx" ON "electoral_nucleus" USING btree ("name");
  CREATE UNIQUE INDEX "electoral_nucleus_slug_idx" ON "electoral_nucleus" USING btree ("slug");
  CREATE INDEX "electoral_nucleus_status_idx" ON "electoral_nucleus" USING btree ("status");
  CREATE INDEX "electoral_nucleus_organization_kind_idx" ON "electoral_nucleus" USING btree ("organization_kind");
  CREATE INDEX "electoral_nucleus_sector_kind_idx" ON "electoral_nucleus" USING btree ("sector_kind");
  CREATE INDEX "electoral_nucleus_primary_contact_idx" ON "electoral_nucleus" USING btree ("primary_contact_id");
  CREATE INDEX "electoral_nucleus_confirmed_vote_estimate_idx" ON "electoral_nucleus" USING btree ("confirmed_vote_estimate");
  CREATE INDEX "electoral_nucleus_confirmed_vote_estimate_by_idx" ON "electoral_nucleus" USING btree ("confirmed_vote_estimate_by_id");
  CREATE INDEX "electoral_nucleus_proposed_vote_estimate_idx" ON "electoral_nucleus" USING btree ("proposed_vote_estimate");
  CREATE INDEX "electoral_nucleus_proposed_vote_estimate_by_idx" ON "electoral_nucleus" USING btree ("proposed_vote_estimate_by_id");
  CREATE INDEX "electoral_nucleus_proposed_vote_estimate_version_idx" ON "electoral_nucleus" USING btree ("proposed_vote_estimate_version");
  CREATE INDEX "electoral_nucleus_last_update_at_idx" ON "electoral_nucleus" USING btree ("last_update_at");
  CREATE INDEX "electoral_nucleus_created_by_idx" ON "electoral_nucleus" USING btree ("created_by_id");
  CREATE INDEX "electoral_nucleus_updated_at_idx" ON "electoral_nucleus" USING btree ("updated_at");
  CREATE INDEX "electoral_nucleus_created_at_idx" ON "electoral_nucleus" USING btree ("created_at");
  CREATE INDEX "electoral_nucleus_texts_order_parent" ON "electoral_nucleus_texts" USING btree ("order","parent_id");
  CREATE INDEX "electoral_nucleus_texts_text_idx" ON "electoral_nucleus_texts" USING btree ("text");
  CREATE INDEX "electoral_nucleus_rels_order_idx" ON "electoral_nucleus_rels" USING btree ("order");
  CREATE INDEX "electoral_nucleus_rels_parent_idx" ON "electoral_nucleus_rels" USING btree ("parent_id");
  CREATE INDEX "electoral_nucleus_rels_path_idx" ON "electoral_nucleus_rels" USING btree ("path");
  CREATE INDEX "electoral_nucleus_rels_campaign_user_id_idx" ON "electoral_nucleus_rels" USING btree ("campaign_user_id");
  CREATE INDEX "nucleus_update_nucleus_idx" ON "nucleus_update" USING btree ("nucleus_id");
  CREATE INDEX "nucleus_update_author_idx" ON "nucleus_update" USING btree ("author_id");
  CREATE INDEX "nucleus_update_kind_idx" ON "nucleus_update" USING btree ("kind");
  CREATE INDEX "nucleus_update_updated_at_idx" ON "nucleus_update" USING btree ("updated_at");
  CREATE INDEX "nucleus_update_created_at_idx" ON "nucleus_update" USING btree ("created_at");
  CREATE INDEX "action_plan_texts_order_parent" ON "action_plan_texts" USING btree ("order","parent_id");
  CREATE INDEX "action_plan_texts_text_idx" ON "action_plan_texts" USING btree ("text");
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_nucleus_id_electoral_nucleus_id_fk" FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supporter" ADD CONSTRAINT "supporter_nucleus_id_electoral_nucleus_id_fk" FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_electoral_nucleus_fk" FOREIGN KEY ("electoral_nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nucleus_update_fk" FOREIGN KEY ("nucleus_update_id") REFERENCES "public"."nucleus_update"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leadership_nucleus_idx" ON "leadership" USING btree ("nucleus_id");
  CREATE UNIQUE INDEX "contact_nucleus_idx" ON "leadership" USING btree ("contact_id","nucleus_id");
  CREATE INDEX "supporter_nucleus_idx" ON "supporter" USING btree ("nucleus_id");
  CREATE INDEX "payload_locked_documents_rels_electoral_nucleus_id_idx" ON "payload_locked_documents_rels" USING btree ("electoral_nucleus_id");
  CREATE INDEX "payload_locked_documents_rels_nucleus_update_id_idx" ON "payload_locked_documents_rels" USING btree ("nucleus_update_id");
  CREATE INDEX "leadership_contact_idx" ON "leadership" USING btree ("contact_id");
  ALTER TABLE "supporter" DROP COLUMN "plaza_id";
  ALTER TABLE "action_plan" DROP COLUMN "deputy_present";
  ALTER TABLE "action_plan" DROP COLUMN "plaza_id";
  ALTER TABLE "action_plan" DROP COLUMN "result_summary";
  ALTER TABLE "action_plan" DROP COLUMN "result_recorded_by_id";
  ALTER TABLE "action_plan" DROP COLUMN "result_recorded_at";
  ALTER TABLE "action_plan_rels" DROP COLUMN "organization_id";
  ALTER TABLE "action_plan_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plaza_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "organization_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vote_pledge_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_demand_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plaza_update_id";
  DROP TYPE "public"."enum_plaza_kind";
  DROP TYPE "public"."enum_plaza_priority";
  DROP TYPE "public"."enum_plaza_political_trend_status";
  DROP TYPE "public"."enum_organization_kind";
  DROP TYPE "public"."enum_campaign_demand_status_history_status";
  DROP TYPE "public"."enum_campaign_demand_kind";
  DROP TYPE "public"."enum_campaign_demand_status";
  DROP TYPE "public"."enum_plaza_update_kind";`)
}
