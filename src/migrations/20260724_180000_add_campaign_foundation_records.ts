import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_municipality_update_kind" ADD VALUE IF NOT EXISTS 'sinal';
    DO $$ BEGIN
      CREATE TYPE "public"."enum_action_plan_origin" AS ENUM ('dado', 'pedido_broker', 'obrigacao_politica');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_municipality_update_signal_type" AS ENUM (
        'invasao',
        'esfriamento',
        'visita_adversario',
        'proposta_broker',
        'outro'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_allocation_decision_outcome" AS ENUM ('aceita', 'descarta');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "municipality_update"
      ADD COLUMN IF NOT EXISTS "signal_type" "public"."enum_municipality_update_signal_type",
      ADD COLUMN IF NOT EXISTS "signal_source" varchar,
      ADD COLUMN IF NOT EXISTS "triangulated" boolean DEFAULT false NOT NULL;
    ALTER TABLE "action_plan" ADD COLUMN IF NOT EXISTS "origin" "public"."enum_action_plan_origin";

    CREATE TABLE IF NOT EXISTS "allocation_decision" (
      "id" serial PRIMARY KEY NOT NULL,
      "municipality_id" integer NOT NULL,
      "pattern_id" varchar NOT NULL,
      "outcome" "public"."enum_allocation_decision_outcome" NOT NULL,
      "rationale" varchar NOT NULL,
      "alternative_reading" varchar,
      "snapshot" jsonb NOT NULL,
      "decided_by_id" integer,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "allocation_decision" ADD CONSTRAINT "allocation_decision_municipality_id_municipality_id_fk"
        FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "allocation_decision" ADD CONSTRAINT "allocation_decision_decided_by_id_campaign_user_id_fk"
        FOREIGN KEY ("decided_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "allocation_decision_municipality_idx" ON "allocation_decision" USING btree ("municipality_id");
    CREATE INDEX IF NOT EXISTS "allocation_decision_pattern_idx" ON "allocation_decision" USING btree ("pattern_id");
    CREATE INDEX IF NOT EXISTS "allocation_decision_decided_by_idx" ON "allocation_decision" USING btree ("decided_by_id");
    CREATE INDEX IF NOT EXISTS "allocation_decision_updated_at_idx" ON "allocation_decision" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "allocation_decision_created_at_idx" ON "allocation_decision" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "allocation_decision_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_allocation_decision_fk"
        FOREIGN KEY ("allocation_decision_id") REFERENCES "public"."allocation_decision"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_allocation_decision_id_idx"
      ON "payload_locked_documents_rels" USING btree ("allocation_decision_id");

    CREATE TABLE IF NOT EXISTS "_vote_pledge_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_leadership_id" integer,
      "version_municipality_id" integer,
      "version_declared_votes" numeric,
      "version_declared_at" timestamp(3) with time zone,
      "version_declared_by_id" integer,
      "version_estimated_votes_pessimistic" numeric,
      "version_estimated_votes_central" numeric,
      "version_estimated_votes_optimistic" numeric,
      "version_estimate_note" varchar,
      "version_estimated_by_id" integer,
      "version_estimated_at" timestamp(3) with time zone,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "_vote_pledge_v" ADD CONSTRAINT "_vote_pledge_v_parent_id_vote_pledge_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."vote_pledge"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "_vote_pledge_v" ADD CONSTRAINT "_vote_pledge_v_version_leadership_id_leadership_id_fk"
        FOREIGN KEY ("version_leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "_vote_pledge_v" ADD CONSTRAINT "_vote_pledge_v_version_municipality_id_municipality_id_fk"
        FOREIGN KEY ("version_municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "_vote_pledge_v" ADD CONSTRAINT "_vote_pledge_v_version_declared_by_id_campaign_user_id_fk"
        FOREIGN KEY ("version_declared_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "_vote_pledge_v" ADD CONSTRAINT "_vote_pledge_v_version_estimated_by_id_campaign_user_id_fk"
        FOREIGN KEY ("version_estimated_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_parent_idx" ON "_vote_pledge_v" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_leadership_idx" ON "_vote_pledge_v" USING btree ("version_leadership_id");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_municipality_idx" ON "_vote_pledge_v" USING btree ("version_municipality_id");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_declared_votes_idx" ON "_vote_pledge_v" USING btree ("version_declared_votes");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_declared_by_idx" ON "_vote_pledge_v" USING btree ("version_declared_by_id");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_estimated_by_idx" ON "_vote_pledge_v" USING btree ("version_estimated_by_id");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_updated_at_idx" ON "_vote_pledge_v" USING btree ("version_updated_at");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_version_version_created_at_idx" ON "_vote_pledge_v" USING btree ("version_created_at");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_created_at_idx" ON "_vote_pledge_v" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "_vote_pledge_v_updated_at_idx" ON "_vote_pledge_v" USING btree ("updated_at");

    INSERT INTO "_vote_pledge_v" (
      "parent_id",
      "version_leadership_id",
      "version_municipality_id",
      "version_declared_votes",
      "version_declared_at",
      "version_declared_by_id",
      "version_estimated_votes_pessimistic",
      "version_estimated_votes_central",
      "version_estimated_votes_optimistic",
      "version_estimate_note",
      "version_estimated_by_id",
      "version_estimated_at",
      "version_updated_at",
      "version_created_at",
      "created_at",
      "updated_at"
    )
    SELECT
      "id",
      "leadership_id",
      "municipality_id",
      "declared_votes",
      "declared_at",
      "declared_by_id",
      "estimated_votes_pessimistic",
      "estimated_votes_central",
      "estimated_votes_optimistic",
      "estimate_note",
      "estimated_by_id",
      "estimated_at",
      "updated_at",
      "created_at",
      "created_at",
      "updated_at"
    FROM "vote_pledge"
    WHERE NOT EXISTS (
      SELECT 1 FROM "_vote_pledge_v" AS versions WHERE versions."parent_id" = "vote_pledge"."id"
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "_vote_pledge_v";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_allocation_decision_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_allocation_decision_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "allocation_decision_id";
    DROP TABLE IF EXISTS "allocation_decision";
    ALTER TABLE "action_plan" DROP COLUMN IF EXISTS "origin";
    ALTER TABLE "municipality_update"
      DROP COLUMN IF EXISTS "triangulated",
      DROP COLUMN IF EXISTS "signal_source",
      DROP COLUMN IF EXISTS "signal_type";
    DROP TYPE IF EXISTS "public"."enum_action_plan_origin";
    DROP TYPE IF EXISTS "public"."enum_municipality_update_signal_type";
    DROP TYPE IF EXISTS "public"."enum_allocation_decision_outcome";
  `)
}
