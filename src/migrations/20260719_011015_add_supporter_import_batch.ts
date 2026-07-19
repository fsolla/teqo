import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `supporterImportBatch` staging collection (roadmap C6, Phase 5):
 * short-lived server-side storage for the supporter CSV import wizard so the
 * full ok-row set never crosses the Server Action boundary twice.
 *
 * Hand-trimmed from the Payload-generated diff: the generator also tried to
 * recreate the `supporter` table, its enums, FKs, indexes, and the
 * `payload_locked_documents_rels.supporter_id` column — all of which already
 * exist via `20260718_222656_add_supporter`. Those drift statements were
 * removed so this migration is idempotent against databases that already ran
 * the supporter migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "supporter_import_batch" (
      "id" serial PRIMARY KEY NOT NULL,
      "batch_id" varchar NOT NULL,
      "actor_id" integer NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "rows" jsonb NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "supporter_import_batch_id" integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_import_batch_actor_id_campaign_user_id_fk'
      ) THEN
        ALTER TABLE "supporter_import_batch"
          ADD CONSTRAINT "supporter_import_batch_actor_id_campaign_user_id_fk"
          FOREIGN KEY ("actor_id") REFERENCES "public"."campaign_user"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "supporter_import_batch_batch_id_idx"
      ON "supporter_import_batch" USING btree ("batch_id");
    CREATE INDEX IF NOT EXISTS "supporter_import_batch_actor_idx"
      ON "supporter_import_batch" USING btree ("actor_id");
    CREATE INDEX IF NOT EXISTS "supporter_import_batch_expires_at_idx"
      ON "supporter_import_batch" USING btree ("expires_at");
    CREATE INDEX IF NOT EXISTS "supporter_import_batch_updated_at_idx"
      ON "supporter_import_batch" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "supporter_import_batch_created_at_idx"
      ON "supporter_import_batch" USING btree ("created_at");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_supporter_import_batch_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_supporter_import_batch_fk"
          FOREIGN KEY ("supporter_import_batch_id") REFERENCES "public"."supporter_import_batch"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_supporter_import_batch_id_idx"
      ON "payload_locked_documents_rels" USING btree ("supporter_import_batch_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_supporter_import_batch_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_supporter_import_batch_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "supporter_import_batch_id";

    DROP TABLE IF EXISTS "supporter_import_batch" CASCADE;
  `)
}
