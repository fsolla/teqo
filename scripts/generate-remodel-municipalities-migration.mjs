import { writeFileSync } from 'fs'
import { municipalityCatalog } from '../src/lib/municipalityCatalog.ts'

const esc = (s) => String(s).replace(/'/g, "''")
const seedRows = municipalityCatalog
  .map(
    (e) =>
      `(${[
        `'${esc(e.name)}'`,
        `'${esc(e.slug)}'`,
        `'${e.kind}'::"public"."enum_municipality_kind"`,
        `'${esc(e.city)}'`,
        `'${esc(e.region)}'`,
        `'${e.ibgeCode}'`,
        `'${e.tseCityCode}'`,
        e.zoneNumber ?? 'NULL',
      ].join(', ')})`,
  )
  .join(',\n  ')

const content = `import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Destructive remodel: Praça → Município (product decision 2026-07-23).
  await db.execute(sql\`
    DELETE FROM "campaign_invite";
    DELETE FROM "supporter";
    DELETE FROM "supporter_import_batch";
    DELETE FROM "action_plan";
    DELETE FROM "leadership";
    DELETE FROM "vote_pledge";
    DELETE FROM "campaign_demand";
    DELETE FROM "plaza_update";
    DELETE FROM "organization";
  \`)

  await db.execute(sql\`
    DROP TABLE IF EXISTS "plaza_update" CASCADE;
    DROP TABLE IF EXISTS "plaza_rels" CASCADE;
    DROP TABLE IF EXISTS "plaza_strengths" CASCADE;
    DROP TABLE IF EXISTS "plaza_risks" CASCADE;
    DROP TABLE IF EXISTS "plaza" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_plaza_kind";
    DROP TYPE IF EXISTS "public"."enum_plaza_priority";
    DROP TYPE IF EXISTS "public"."enum_plaza_political_trend_status";
    DROP TYPE IF EXISTS "public"."enum_plaza_update_kind";
  \`)

  await db.execute(sql\`
    CREATE TYPE "public"."enum_municipality_kind" AS ENUM('municipio', 'zona');
    CREATE TYPE "public"."enum_municipality_priority" AS ENUM('alta', 'normal');
    CREATE TYPE "public"."enum_municipality_political_trend_status" AS ENUM('favoravel', 'neutra', 'desfavoravel');
    CREATE TYPE "public"."enum_municipality_update_kind" AS ENUM('semanal', 'urgente', 'nota');

    CREATE TABLE "municipality_strengths" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL
    );

    CREATE TABLE "municipality_risks" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL
    );

    CREATE TABLE "municipality" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "kind" "enum_municipality_kind" NOT NULL,
      "city" varchar NOT NULL,
      "region" varchar NOT NULL,
      "ibge_code" varchar NOT NULL,
      "tse_city_code" varchar NOT NULL,
      "zone_number" numeric,
      "priority" "enum_municipality_priority" DEFAULT 'normal',
      "vote_goals_good" numeric,
      "vote_goals_regular" numeric,
      "vote_goals_minimum" numeric,
      "expected_votes_pessimistic" numeric,
      "expected_votes_central" numeric,
      "expected_votes_optimistic" numeric,
      "political_trend_status" "enum_municipality_political_trend_status",
      "political_trend_note" varchar,
      "political_trend_recorded_by_id" integer,
      "political_trend_recorded_at" timestamp(3) with time zone,
      "dobradinha_notes" varchar,
      "next_steps" varchar,
      "last_update_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "municipality_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "campaign_user_id" integer,
      "state_deputy_id" integer
    );

    CREATE TABLE "municipality_update" (
      "id" serial PRIMARY KEY NOT NULL,
      "municipality_id" integer NOT NULL,
      "author_id" integer,
      "kind" "enum_municipality_update_kind" NOT NULL,
      "body" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX "municipality_slug_idx" ON "municipality" USING btree ("slug");
    CREATE UNIQUE INDEX "municipality_name_idx" ON "municipality" USING btree ("name");
  \`)

  await db.execute(sql\`ALTER TYPE "public"."enum_campaign_user_role" ADD VALUE IF NOT EXISTS 'candidate'\`)
  await db.execute(sql\`ALTER TYPE "public"."enum_supporter_source" ADD VALUE IF NOT EXISTS 'lideranca'\`)

  await db.execute(sql\`
    ALTER TABLE "supporter" RENAME COLUMN "plaza_id" TO "municipality_id";
    ALTER TABLE "vote_pledge" RENAME COLUMN "plaza_id" TO "municipality_id";
    ALTER TABLE "action_plan" RENAME COLUMN "plaza_id" TO "municipality_id";
    ALTER TABLE "campaign_demand" RENAME COLUMN "plaza_id" TO "municipality_id";
    ALTER TABLE "leadership_rels" RENAME COLUMN "plaza_id" TO "municipality_id";
    ALTER TABLE "organization_rels" RENAME COLUMN "plaza_id" TO "municipality_id";
  \`)

  await db.execute(sql\`
    INSERT INTO "municipality" ("name", "slug", "kind", "city", "region", "ibge_code", "tse_city_code", "zone_number")
    VALUES
    ${seedRows}
    ON CONFLICT DO NOTHING;
  \`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  throw new Error('remodel_municipalities is irreversible')
}
`

writeFileSync('src/migrations/20260723_200000_remodel_municipalities.ts', content)
console.log(`Wrote migration with ${municipalityCatalog.length} seed rows`)
