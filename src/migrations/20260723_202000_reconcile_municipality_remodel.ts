import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Closes schema gaps left by the hand-written remodel migration: full
 * municipality_update shape, locked-document rel renames, and FK/index wiring.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "municipality_update"
      ADD COLUMN IF NOT EXISTS "worked" varchar,
      ADD COLUMN IF NOT EXISTS "failed" varchar,
      ADD COLUMN IF NOT EXISTS "needs" varchar,
      ADD COLUMN IF NOT EXISTS "active_volunteers" numeric,
      ADD COLUMN IF NOT EXISTS "new_supports" numeric;

    ALTER TABLE "municipality_update" ALTER COLUMN "kind" SET DEFAULT 'semanal';
    ALTER TABLE "municipality_update" ALTER COLUMN "body" DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS "municipality_update_municipality_idx"
      ON "municipality_update" USING btree ("municipality_id");
    CREATE INDEX IF NOT EXISTS "municipality_update_author_idx"
      ON "municipality_update" USING btree ("author_id");
    CREATE INDEX IF NOT EXISTS "municipality_update_kind_idx"
      ON "municipality_update" USING btree ("kind");
    CREATE INDEX IF NOT EXISTS "municipality_update_updated_at_idx"
      ON "municipality_update" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "municipality_update_created_at_idx"
      ON "municipality_update" USING btree ("created_at");

    ALTER TABLE "municipality_update" DROP CONSTRAINT IF EXISTS "municipality_update_municipality_id_municipality_id_fk";
    ALTER TABLE "municipality_update" ADD CONSTRAINT "municipality_update_municipality_id_municipality_id_fk"
      FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "municipality_update" DROP CONSTRAINT IF EXISTS "municipality_update_author_id_campaign_user_id_fk";
    ALTER TABLE "municipality_update" ADD CONSTRAINT "municipality_update_author_id_campaign_user_id_fk"
      FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "municipality_strengths_order_idx"
      ON "municipality_strengths" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "municipality_strengths_parent_id_idx"
      ON "municipality_strengths" USING btree ("_parent_id");
    ALTER TABLE "municipality_strengths" DROP CONSTRAINT IF EXISTS "municipality_strengths_parent_id_fk";
    ALTER TABLE "municipality_strengths" ADD CONSTRAINT "municipality_strengths_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."municipality"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "municipality_risks_order_idx"
      ON "municipality_risks" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "municipality_risks_parent_id_idx"
      ON "municipality_risks" USING btree ("_parent_id");
    ALTER TABLE "municipality_risks" DROP CONSTRAINT IF EXISTS "municipality_risks_parent_id_fk";
    ALTER TABLE "municipality_risks" ADD CONSTRAINT "municipality_risks_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."municipality"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "municipality_rels_order_idx"
      ON "municipality_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "municipality_rels_parent_idx"
      ON "municipality_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "municipality_rels_path_idx"
      ON "municipality_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "municipality_rels_campaign_user_id_idx"
      ON "municipality_rels" USING btree ("campaign_user_id");
    ALTER TABLE "municipality_rels" DROP CONSTRAINT IF EXISTS "municipality_rels_parent_fk";
    ALTER TABLE "municipality_rels" ADD CONSTRAINT "municipality_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."municipality"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "municipality_rels" DROP CONSTRAINT IF EXISTS "municipality_rels_campaign_user_fk";
    ALTER TABLE "municipality_rels" ADD CONSTRAINT "municipality_rels_campaign_user_fk"
      FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "municipality_city_idx" ON "municipality" USING btree ("city");
    CREATE INDEX IF NOT EXISTS "municipality_region_idx" ON "municipality" USING btree ("region");
    CREATE INDEX IF NOT EXISTS "municipality_ibge_code_idx" ON "municipality" USING btree ("ibge_code");
    CREATE INDEX IF NOT EXISTS "municipality_tse_city_code_idx" ON "municipality" USING btree ("tse_city_code");
    CREATE INDEX IF NOT EXISTS "municipality_priority_idx" ON "municipality" USING btree ("priority");
    CREATE INDEX IF NOT EXISTS "municipality_updated_at_idx" ON "municipality" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "municipality_created_at_idx" ON "municipality" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "municipality_political_trend_recorded_by_idx"
      ON "municipality" USING btree ("political_trend_recorded_by_id");

    ALTER TABLE "municipality" DROP CONSTRAINT IF EXISTS "municipality_political_trend_recorded_by_id_campaign_user_id_fk";
    ALTER TABLE "municipality" ADD CONSTRAINT "municipality_political_trend_recorded_by_id_campaign_user_id_fk"
      FOREIGN KEY ("political_trend_recorded_by_id") REFERENCES "public"."campaign_user"("id")
      ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`
    DO $rename$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'plaza_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "plaza_id" TO "municipality_id";
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payload_locked_documents_rels' AND column_name = 'plaza_update_id'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "plaza_update_id" TO "municipality_update_id";
      END IF;
    END
    $rename$;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plaza_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plaza_update_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_municipality_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_municipality_update_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_plaza_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_plaza_update_id_idx";

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_municipality_id_idx"
      ON "payload_locked_documents_rels" USING btree ("municipality_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_municipality_update_id_idx"
      ON "payload_locked_documents_rels" USING btree ("municipality_update_id");

    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_municipality_fk"
      FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_municipality_update_fk"
      FOREIGN KEY ("municipality_update_id") REFERENCES "public"."municipality_update"("id")
      ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  throw new Error('reconcile_municipality_remodel is irreversible')
}
