import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const EXPECTED_SCHEMA_FACT_COUNT = 390
const EXPECTED_SCHEMA_FINGERPRINT = '7f52cee901559d70c0bd0be58152972d'

type FingerprintRow = {
  fact_count: number | string
  feature_count: number | string
  fingerprint: string | null
}

const resultRows = <Row>(result: unknown): Row[] => {
  if (Array.isArray(result)) return result as Row[]
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    return (result as { rows: Row[] }).rows
  }
  return []
}

const readFinalSchemaFingerprint = async (
  db: MigrateUpArgs['db'],
): Promise<{ count: number; featureCount: number; fingerprint: string | null }> => {
  const result = await db.execute(sql`
    WITH schema_tables(name) AS (
      VALUES
        ('campaign_user'),
        ('campaign_user_sessions'),
        ('campaign_invite'),
        ('consent'),
        ('contact'),
        ('electoral_nucleus'),
        ('electoral_nucleus_rels'),
        ('electoral_nucleus_tse_zones'),
        ('electoral_nucleus_voter_profiles'),
        ('electoral_nucleus_strengths'),
        ('electoral_nucleus_risks'),
        ('leadership'),
        ('nucleus_update'),
        ('payload_locked_documents_rels'),
        ('payload_preferences_rels')
    ),
    altered_base_columns(table_name, column_name) AS (
      VALUES
        ('campaign_user', 'email'),
        ('campaign_user', 'role'),
        ('campaign_user', 'phone'),
        ('campaign_user', 'username'),
        ('contact', 'email'),
        ('contact', 'city'),
        ('contact', 'gender'),
        ('consent', 'key'),
        ('payload_locked_documents_rels', 'campaign_invite_id'),
        ('payload_locked_documents_rels', 'electoral_nucleus_id'),
        ('payload_locked_documents_rels', 'leadership_id'),
        ('payload_locked_documents_rels', 'nucleus_update_id')
    ),
    enum_types(name) AS (
      VALUES
        ('enum_campaign_user_role'),
        ('enum_campaign_invite_kind'),
        ('enum_electoral_nucleus_status'),
        ('enum_electoral_nucleus_organization_kind'),
        ('enum_electoral_nucleus_sector_kind'),
        ('enum_leadership_sector'),
        ('enum_leadership_support_status'),
        ('enum_nucleus_update_kind'),
        ('enum_contact_gender')
    ),
    feature_markers AS (
      SELECT c.table_name || '.' || c.column_name AS marker
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND (c.table_name, c.column_name) IN (
          SELECT table_name, column_name
          FROM altered_base_columns
          WHERE column_name NOT IN ('email', 'city')
        )
      UNION ALL
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'campaign_invite',
          'electoral_nucleus',
          'leadership',
          'nucleus_update'
        )
      UNION ALL
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname IN (SELECT name FROM enum_types)
    ),
    facts AS (
      SELECT
        'column|' || c.table_name || '|' || c.column_name || '|' || c.data_type || '|' ||
        coalesce(c.udt_name, '') || '|' || c.is_nullable || '|' ||
        coalesce(c.column_default, '') AS fact
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN (SELECT name FROM schema_tables)
      UNION ALL
      SELECT
        'constraint|' || rel.relname || '|' || con.conname || '|' ||
        con.contype::text || '|' || pg_get_constraintdef(con.oid, true)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname IN (SELECT name FROM schema_tables)
      UNION ALL
      SELECT
        'foreign-key|' || source_rel.relname || '|' || con.conname || '|' ||
        source_columns.names || '|' || target_rel.relname || '|' ||
        target_columns.names || '|' || con.confupdtype::text || '|' || con.confdeltype::text
      FROM pg_constraint con
      JOIN pg_class source_rel ON source_rel.oid = con.conrelid
      JOIN pg_class target_rel ON target_rel.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = source_rel.relnamespace
      CROSS JOIN LATERAL (
        SELECT string_agg(att.attname, ',' ORDER BY key.position) AS names
        FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = key.attnum
      ) source_columns
      CROSS JOIN LATERAL (
        SELECT string_agg(att.attname, ',' ORDER BY key.position) AS names
        FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute att
          ON att.attrelid = con.confrelid AND att.attnum = key.attnum
      ) target_columns
      WHERE n.nspname = 'public'
        AND con.contype = 'f'
        AND source_rel.relname IN (SELECT name FROM schema_tables)
      UNION ALL
      SELECT 'index|' || idx.relname || '|' || pg_get_indexdef(idx.oid)
      FROM pg_class idx
      JOIN pg_index i ON i.indexrelid = idx.oid
      JOIN pg_class rel ON rel.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname IN (SELECT name FROM schema_tables)
      UNION ALL
      SELECT 'enum|' || t.typname || '|' || e.enumsortorder || '|' || e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname IN (SELECT name FROM enum_types)
    )
    SELECT
      count(*) AS fact_count,
      (SELECT count(*) FROM feature_markers) AS feature_count,
      md5(string_agg(fact, E'\n' ORDER BY fact)) AS fingerprint
    FROM facts
  `)
  const row = resultRows<FingerprintRow>(result)[0]
  return {
    count: Number(row?.fact_count ?? 0),
    featureCount: Number(row?.feature_count ?? 0),
    fingerprint: row?.fingerprint ?? null,
  }
}

const assertFinalSchema = async (db: MigrateUpArgs['db']): Promise<void> => {
  const actual = await readFinalSchemaFingerprint(db)
  if (
    actual.count !== EXPECTED_SCHEMA_FACT_COUNT ||
    actual.fingerprint !== EXPECTED_SCHEMA_FINGERPRINT
  ) {
    throw new Error(
      `Refusing campaign schema reconciliation: expected ${EXPECTED_SCHEMA_FACT_COUNT}/${EXPECTED_SCHEMA_FINGERPRINT}, received ${actual.count}/${actual.fingerprint ?? 'null'}`,
    )
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const existingSchema = await readFinalSchemaFingerprint(db)
  if (existingSchema.featureCount > 0) {
    await assertFinalSchema(db)
    return
  }

  await db.execute(sql`
   CREATE TYPE "public"."enum_campaign_user_role" AS ENUM('geral', 'coordenador', 'lideranca');
  CREATE TYPE "public"."enum_campaign_invite_kind" AS ENUM('login', 'autopreenchimento');
  CREATE TYPE "public"."enum_electoral_nucleus_status" AS ENUM('ativo', 'arquivado');
  CREATE TYPE "public"."enum_electoral_nucleus_organization_kind" AS ENUM('territorial', 'associacao', 'sindicato', 'religioso', 'movimento', 'categoria_profissional', 'outro');
  CREATE TYPE "public"."enum_electoral_nucleus_sector_kind" AS ENUM('rural', 'religioso', 'sindical', 'empresarial', 'juventude', 'saude', 'educacao', 'cultura', 'outro');
  CREATE TYPE "public"."enum_leadership_sector" AS ENUM('religioso', 'sindical', 'comunitario', 'rural', 'empresarial', 'juventude', 'saude', 'educacao', 'cultura', 'outro');
  CREATE TYPE "public"."enum_leadership_support_status" AS ENUM('engajado', 'a_abordar', 'em_disputa', 'negativo');
  CREATE TYPE "public"."enum_nucleus_update_kind" AS ENUM('semanal', 'urgente', 'nota');
  CREATE TYPE "public"."enum_contact_gender" AS ENUM('feminino', 'masculino', 'outro', 'nao_informado');
  CREATE TABLE "campaign_invite" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"leadership_id" integer NOT NULL,
  	"kind" "enum_campaign_invite_kind" NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  	"region" varchar,
  	"city" varchar,
  	"neighborhood" varchar,
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
  
  CREATE TABLE "electoral_nucleus_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaign_user_id" integer
  );
  
  CREATE TABLE "leadership" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_id" integer NOT NULL,
  	"nucleus_id" integer NOT NULL,
  	"sector" "enum_leadership_sector",
  	"sector_notes" varchar,
  	"support_status" "enum_leadership_support_status" DEFAULT 'a_abordar' NOT NULL,
  	"user_id" integer,
  	"consent_id" integer,
  	"consent_content_hash" varchar,
  	"consented_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"consent_note" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  ALTER TABLE "campaign_user" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "contact" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "contact" ALTER COLUMN "city" DROP NOT NULL;
  ALTER TABLE "campaign_user" ADD COLUMN "role" "enum_campaign_user_role" DEFAULT 'lideranca' NOT NULL;
  UPDATE "campaign_user" SET "role" = 'geral';
  ALTER TABLE "campaign_user" ADD COLUMN "phone" varchar;
  ALTER TABLE "campaign_user" ADD COLUMN "username" varchar;
  ALTER TABLE "contact" ADD COLUMN "gender" "enum_contact_gender";
  ALTER TABLE "consent" ADD COLUMN "key" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_invite_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "electoral_nucleus_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "leadership_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "nucleus_update_id" integer;
  ALTER TABLE "campaign_invite" ADD CONSTRAINT "campaign_invite_leadership_id_leadership_id_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_invite" ADD CONSTRAINT "campaign_invite_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_tse_zones" ADD CONSTRAINT "electoral_nucleus_tse_zones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_voter_profiles" ADD CONSTRAINT "electoral_nucleus_voter_profiles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_strengths" ADD CONSTRAINT "electoral_nucleus_strengths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_risks" ADD CONSTRAINT "electoral_nucleus_risks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_primary_contact_id_contact_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_confirmed_vote_estimate_by_id_campaign_user_id_fk" FOREIGN KEY ("confirmed_vote_estimate_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_proposed_vote_estimate_by_id_campaign_user_id_fk" FOREIGN KEY ("proposed_vote_estimate_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus" ADD CONSTRAINT "electoral_nucleus_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_rels" ADD CONSTRAINT "electoral_nucleus_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "electoral_nucleus_rels" ADD CONSTRAINT "electoral_nucleus_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_nucleus_id_electoral_nucleus_id_fk" FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_user_id_campaign_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_consent_id_consent_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leadership" ADD CONSTRAINT "leadership_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nucleus_update" ADD CONSTRAINT "nucleus_update_nucleus_id_electoral_nucleus_id_fk" FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nucleus_update" ADD CONSTRAINT "nucleus_update_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "campaign_invite_token_hash_idx" ON "campaign_invite" USING btree ("token_hash");
  CREATE INDEX "campaign_invite_leadership_idx" ON "campaign_invite" USING btree ("leadership_id");
  CREATE INDEX "campaign_invite_kind_idx" ON "campaign_invite" USING btree ("kind");
  CREATE INDEX "campaign_invite_expires_at_idx" ON "campaign_invite" USING btree ("expires_at");
  CREATE INDEX "campaign_invite_used_at_idx" ON "campaign_invite" USING btree ("used_at");
  CREATE INDEX "campaign_invite_revoked_at_idx" ON "campaign_invite" USING btree ("revoked_at");
  CREATE INDEX "campaign_invite_created_by_idx" ON "campaign_invite" USING btree ("created_by_id");
  CREATE INDEX "campaign_invite_updated_at_idx" ON "campaign_invite" USING btree ("updated_at");
  CREATE INDEX "campaign_invite_created_at_idx" ON "campaign_invite" USING btree ("created_at");
  CREATE INDEX "leadership_kind_idx" ON "campaign_invite" USING btree ("leadership_id","kind");
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
  CREATE INDEX "electoral_nucleus_region_idx" ON "electoral_nucleus" USING btree ("region");
  CREATE INDEX "electoral_nucleus_city_idx" ON "electoral_nucleus" USING btree ("city");
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
  CREATE INDEX "electoral_nucleus_rels_order_idx" ON "electoral_nucleus_rels" USING btree ("order");
  CREATE INDEX "electoral_nucleus_rels_parent_idx" ON "electoral_nucleus_rels" USING btree ("parent_id");
  CREATE INDEX "electoral_nucleus_rels_path_idx" ON "electoral_nucleus_rels" USING btree ("path");
  CREATE INDEX "electoral_nucleus_rels_campaign_user_id_idx" ON "electoral_nucleus_rels" USING btree ("campaign_user_id");
  CREATE INDEX "leadership_contact_idx" ON "leadership" USING btree ("contact_id");
  CREATE INDEX "leadership_nucleus_idx" ON "leadership" USING btree ("nucleus_id");
  CREATE INDEX "leadership_sector_idx" ON "leadership" USING btree ("sector");
  CREATE INDEX "leadership_support_status_idx" ON "leadership" USING btree ("support_status");
  CREATE INDEX "leadership_user_idx" ON "leadership" USING btree ("user_id");
  CREATE INDEX "leadership_consent_idx" ON "leadership" USING btree ("consent_id");
  CREATE INDEX "leadership_created_by_idx" ON "leadership" USING btree ("created_by_id");
  CREATE INDEX "leadership_updated_at_idx" ON "leadership" USING btree ("updated_at");
  CREATE INDEX "leadership_created_at_idx" ON "leadership" USING btree ("created_at");
  CREATE UNIQUE INDEX "contact_nucleus_idx" ON "leadership" USING btree ("contact_id","nucleus_id");
  CREATE INDEX "nucleus_update_nucleus_idx" ON "nucleus_update" USING btree ("nucleus_id");
  CREATE INDEX "nucleus_update_author_idx" ON "nucleus_update" USING btree ("author_id");
  CREATE INDEX "nucleus_update_kind_idx" ON "nucleus_update" USING btree ("kind");
  CREATE INDEX "nucleus_update_updated_at_idx" ON "nucleus_update" USING btree ("updated_at");
  CREATE INDEX "nucleus_update_created_at_idx" ON "nucleus_update" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_invite_fk" FOREIGN KEY ("campaign_invite_id") REFERENCES "public"."campaign_invite"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_electoral_nucleus_fk" FOREIGN KEY ("electoral_nucleus_id") REFERENCES "public"."electoral_nucleus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leadership_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nucleus_update_fk" FOREIGN KEY ("nucleus_update_id") REFERENCES "public"."nucleus_update"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "campaign_user_phone_idx" ON "campaign_user" USING btree ("phone");
  CREATE UNIQUE INDEX "campaign_user_username_idx" ON "campaign_user" USING btree ("username");
  CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone");
  CREATE UNIQUE INDEX "consent_key_idx" ON "consent" USING btree ("key");
  CREATE INDEX "payload_locked_documents_rels_campaign_invite_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_invite_id");
  CREATE INDEX "payload_locked_documents_rels_electoral_nucleus_id_idx" ON "payload_locked_documents_rels" USING btree ("electoral_nucleus_id");
  CREATE INDEX "payload_locked_documents_rels_leadership_id_idx" ON "payload_locked_documents_rels" USING btree ("leadership_id");
  CREATE INDEX "payload_locked_documents_rels_nucleus_update_id_idx" ON "payload_locked_documents_rels" USING btree ("nucleus_update_id");`)
  await assertFinalSchema(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM "campaign_user")
      OR EXISTS (SELECT 1 FROM "contact" WHERE "email" IS NULL OR "city" IS NULL OR "gender" IS NOT NULL)
      OR EXISTS (SELECT 1 FROM "consent" WHERE "key" IS NOT NULL)
      OR EXISTS (SELECT 1 FROM "campaign_invite")
      OR EXISTS (SELECT 1 FROM "electoral_nucleus")
      OR EXISTS (SELECT 1 FROM "leadership")
      OR EXISTS (SELECT 1 FROM "nucleus_update") THEN
      RAISE EXCEPTION 'Refusing to roll back consolidated campaign schema while campaign or nullable contact data exists';
    END IF;
  END $$;

  ALTER TABLE "payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_invite_fk";
  ALTER TABLE "payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_electoral_nucleus_fk";
  ALTER TABLE "payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_leadership_fk";
  ALTER TABLE "payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_nucleus_update_fk";

  DROP INDEX IF EXISTS "payload_locked_documents_rels_campaign_invite_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_electoral_nucleus_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_leadership_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_nucleus_update_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "campaign_invite_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "electoral_nucleus_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "leadership_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "nucleus_update_id";

  ALTER TABLE "campaign_invite" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_tse_zones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_voter_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_strengths" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_risks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "electoral_nucleus_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "leadership" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "nucleus_update" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "campaign_invite" CASCADE;
  DROP TABLE "nucleus_update" CASCADE;
  DROP TABLE "leadership" CASCADE;
  DROP TABLE "electoral_nucleus_tse_zones" CASCADE;
  DROP TABLE "electoral_nucleus_voter_profiles" CASCADE;
  DROP TABLE "electoral_nucleus_strengths" CASCADE;
  DROP TABLE "electoral_nucleus_risks" CASCADE;
  DROP TABLE "electoral_nucleus_rels" CASCADE;
  DROP TABLE "electoral_nucleus" CASCADE;

  DROP INDEX IF EXISTS "campaign_user_phone_idx";
  DROP INDEX IF EXISTS "campaign_user_username_idx";
  DROP INDEX IF EXISTS "contact_phone_idx";
  DROP INDEX IF EXISTS "consent_key_idx";
  ALTER TABLE "campaign_user" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "contact" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "contact" ALTER COLUMN "city" SET NOT NULL;
  ALTER TABLE "campaign_user" DROP COLUMN IF EXISTS "role";
  ALTER TABLE "campaign_user" DROP COLUMN IF EXISTS "phone";
  ALTER TABLE "campaign_user" DROP COLUMN IF EXISTS "username";
  ALTER TABLE "contact" DROP COLUMN IF EXISTS "gender";
  ALTER TABLE "consent" DROP COLUMN IF EXISTS "key";
  ALTER TABLE "payload_locked_documents_rels"
    DROP CONSTRAINT "payload_locked_documents_rels_campaign_user_fk";
  ALTER TABLE "payload_preferences_rels"
    DROP CONSTRAINT "payload_preferences_rels_campaign_user_fk";
  ALTER TABLE "payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_campaign_user_fk"
    FOREIGN KEY ("campaign_user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels"
    ADD CONSTRAINT "payload_preferences_rels_campaign_user_fk"
    FOREIGN KEY ("campaign_user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
  DROP TYPE "public"."enum_campaign_user_role";
  DROP TYPE "public"."enum_campaign_invite_kind";
  DROP TYPE "public"."enum_electoral_nucleus_status";
  DROP TYPE "public"."enum_electoral_nucleus_organization_kind";
  DROP TYPE "public"."enum_electoral_nucleus_sector_kind";
  DROP TYPE "public"."enum_leadership_sector";
  DROP TYPE "public"."enum_leadership_support_status";
  DROP TYPE "public"."enum_nucleus_update_kind";
  DROP TYPE "public"."enum_contact_gender";`)
}
