import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_action_plan_kind" AS ENUM('caminhada', 'comicio', 'carreata', 'panfletagem', 'porta_a_porta', 'reuniao_apoio', 'lancamento', 'convencao', 'ato', 'entrevista', 'producao_conteudo', 'digital', 'outro');
  CREATE TYPE "public"."enum_action_plan_status" AS ENUM('rascunho', 'planejado', 'confirmado', 'realizado', 'cancelado');

  CREATE TABLE "action_plan_tasks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"responsible_id" integer,
  	"due" timestamp(3) with time zone,
  	"done" boolean DEFAULT false,
  	"done_at" timestamp(3) with time zone
  );

  CREATE TABLE "action_plan_updates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "action_plan" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_action_plan_kind" NOT NULL,
  	"status" "enum_action_plan_status" DEFAULT 'rascunho' NOT NULL,
  	"description" varchar,
  	"start_at" timestamp(3) with time zone,
  	"end_at" timestamp(3) with time zone,
  	"deadline" timestamp(3) with time zone,
  	"locality" varchar,
  	"territory_notes" varchar,
  	"responsible_id" integer,
  	"leadership_id" integer,
  	"created_by_id" integer,
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

  CREATE TABLE "action_plan_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaign_user_id" integer
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "action_plan_id" integer;

  ALTER TABLE "action_plan_tasks" ADD CONSTRAINT "action_plan_tasks_responsible_id_contact_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan_tasks" ADD CONSTRAINT "action_plan_tasks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "action_plan_updates" ADD CONSTRAINT "action_plan_updates_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan_updates" ADD CONSTRAINT "action_plan_updates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_responsible_id_contact_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_leadership_id_leadership_id_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "action_plan_texts" ADD CONSTRAINT "action_plan_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "action_plan_rels" ADD CONSTRAINT "action_plan_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "action_plan_rels" ADD CONSTRAINT "action_plan_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;

  CREATE INDEX "action_plan_tasks_order_idx" ON "action_plan_tasks" USING btree ("_order");
  CREATE INDEX "action_plan_tasks_parent_id_idx" ON "action_plan_tasks" USING btree ("_parent_id");
  CREATE INDEX "action_plan_tasks_responsible_idx" ON "action_plan_tasks" USING btree ("responsible_id");
  CREATE INDEX "action_plan_updates_order_idx" ON "action_plan_updates" USING btree ("_order");
  CREATE INDEX "action_plan_updates_parent_id_idx" ON "action_plan_updates" USING btree ("_parent_id");
  CREATE INDEX "action_plan_updates_author_idx" ON "action_plan_updates" USING btree ("author_id");
  CREATE INDEX "action_plan_title_idx" ON "action_plan" USING btree ("title");
  CREATE UNIQUE INDEX "action_plan_slug_idx" ON "action_plan" USING btree ("slug");
  CREATE INDEX "action_plan_kind_idx" ON "action_plan" USING btree ("kind");
  CREATE INDEX "action_plan_status_idx" ON "action_plan" USING btree ("status");
  CREATE INDEX "action_plan_start_at_idx" ON "action_plan" USING btree ("start_at");
  CREATE INDEX "action_plan_responsible_idx" ON "action_plan" USING btree ("responsible_id");
  CREATE INDEX "action_plan_leadership_idx" ON "action_plan" USING btree ("leadership_id");
  CREATE INDEX "action_plan_created_by_idx" ON "action_plan" USING btree ("created_by_id");
  CREATE INDEX "action_plan_updated_at_idx" ON "action_plan" USING btree ("updated_at");
  CREATE INDEX "action_plan_created_at_idx" ON "action_plan" USING btree ("created_at");
  CREATE INDEX "action_plan_texts_order_parent" ON "action_plan_texts" USING btree ("order","parent_id");
  CREATE INDEX "action_plan_texts_text_idx" ON "action_plan_texts" USING btree ("text");
  CREATE INDEX "action_plan_rels_order_idx" ON "action_plan_rels" USING btree ("order");
  CREATE INDEX "action_plan_rels_parent_idx" ON "action_plan_rels" USING btree ("parent_id");
  CREATE INDEX "action_plan_rels_path_idx" ON "action_plan_rels" USING btree ("path");
  CREATE INDEX "action_plan_rels_campaign_user_id_idx" ON "action_plan_rels" USING btree ("campaign_user_id");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_action_plan_fk" FOREIGN KEY ("action_plan_id") REFERENCES "public"."action_plan"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_action_plan_id_idx" ON "payload_locked_documents_rels" USING btree ("action_plan_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_action_plan_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_action_plan_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "action_plan_id";

  DROP TABLE IF EXISTS "action_plan_tasks" CASCADE;
  DROP TABLE IF EXISTS "action_plan_updates" CASCADE;
  DROP TABLE IF EXISTS "action_plan_texts" CASCADE;
  DROP TABLE IF EXISTS "action_plan_rels" CASCADE;
  DROP TABLE IF EXISTS "action_plan" CASCADE;

  DROP TYPE IF EXISTS "public"."enum_action_plan_kind";
  DROP TYPE IF EXISTS "public"."enum_action_plan_status";
  `)
}
