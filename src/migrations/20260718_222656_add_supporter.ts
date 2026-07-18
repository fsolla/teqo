import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `supporter` join collection (Contact ↔ campaign, optional nucleus).
 *
 * Hand-trimmed from the Payload-generated diff: the generator also tried to
 * recreate `electoral_nucleus_texts` and drop legacy scalar territory columns
 * that were already handled by `20260718_190559_territorio_multi_municipio_bairro`.
 * Those drift statements were removed so this migration is idempotent against
 * databases that already ran the territory migration.
 *
 * Uniqueness uses `UNIQUE NULLS NOT DISTINCT (contact_id, nucleus_id)` so a
 * contact may have at most one supporter row without a nucleus (Postgres ≥15).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_supporter_vote_intention'
      ) THEN
        CREATE TYPE "public"."enum_supporter_vote_intention" AS ENUM(
          'certo',
          'tende_a_certo',
          'indeciso',
          'outro'
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_supporter_source'
      ) THEN
        CREATE TYPE "public"."enum_supporter_source" AS ENUM(
          'import_csv',
          'manual',
          'convite',
          'evento'
        );
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS "supporter" (
      "id" serial PRIMARY KEY NOT NULL,
      "contact_id" integer NOT NULL,
      "nucleus_id" integer,
      "vote_intention" "enum_supporter_vote_intention",
      "consent_id" integer,
      "consent_content_hash" varchar,
      "consented_at" timestamp(3) with time zone,
      "vote_intention_consent_id" integer,
      "vote_intention_consent_content_hash" varchar,
      "vote_intention_consented_at" timestamp(3) with time zone,
      "source" "enum_supporter_source" DEFAULT 'manual' NOT NULL,
      "consent_note" varchar,
      "notes" varchar,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_contact_id_contact_id_fk'
      ) THEN
        ALTER TABLE "supporter"
          ADD CONSTRAINT "supporter_contact_id_contact_id_fk"
          FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_nucleus_id_electoral_nucleus_id_fk'
      ) THEN
        ALTER TABLE "supporter"
          ADD CONSTRAINT "supporter_nucleus_id_electoral_nucleus_id_fk"
          FOREIGN KEY ("nucleus_id") REFERENCES "public"."electoral_nucleus"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_consent_id_consent_id_fk'
      ) THEN
        ALTER TABLE "supporter"
          ADD CONSTRAINT "supporter_consent_id_consent_id_fk"
          FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_vote_intention_consent_id_consent_id_fk'
      ) THEN
        ALTER TABLE "supporter"
          ADD CONSTRAINT "supporter_vote_intention_consent_id_consent_id_fk"
          FOREIGN KEY ("vote_intention_consent_id") REFERENCES "public"."consent"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'supporter_created_by_id_campaign_user_id_fk'
      ) THEN
        ALTER TABLE "supporter"
          ADD CONSTRAINT "supporter_created_by_id_campaign_user_id_fk"
          FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "supporter_contact_idx" ON "supporter" USING btree ("contact_id");
    CREATE INDEX IF NOT EXISTS "supporter_nucleus_idx" ON "supporter" USING btree ("nucleus_id");
    CREATE INDEX IF NOT EXISTS "supporter_vote_intention_idx" ON "supporter" USING btree ("vote_intention");
    CREATE INDEX IF NOT EXISTS "supporter_consent_idx" ON "supporter" USING btree ("consent_id");
    CREATE INDEX IF NOT EXISTS "supporter_vote_intention_consent_idx" ON "supporter" USING btree ("vote_intention_consent_id");
    CREATE INDEX IF NOT EXISTS "supporter_source_idx" ON "supporter" USING btree ("source");
    CREATE INDEX IF NOT EXISTS "supporter_created_by_idx" ON "supporter" USING btree ("created_by_id");
    CREATE INDEX IF NOT EXISTS "supporter_updated_at_idx" ON "supporter" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "supporter_created_at_idx" ON "supporter" USING btree ("created_at");

    CREATE UNIQUE INDEX IF NOT EXISTS "supporter_contact_nucleus_nulls_not_distinct_idx"
      ON "supporter" ("contact_id", "nucleus_id") NULLS NOT DISTINCT;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "supporter_id" integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_supporter_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_supporter_fk"
          FOREIGN KEY ("supporter_id") REFERENCES "public"."supporter"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_supporter_id_idx"
      ON "payload_locked_documents_rels" USING btree ("supporter_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_supporter_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_supporter_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "supporter_id";

    DROP TABLE IF EXISTS "supporter" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_supporter_vote_intention";
    DROP TYPE IF EXISTS "public"."enum_supporter_source";
  `)
}
