import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Reconciles production schema drift: `consent.text` is a `richText` field in the
 * Payload config (which maps to `jsonb`), but the production database still has it
 * as `varchar`. Its single row already contains valid Lexical JSON, so the cast is
 * lossless. This migration is idempotent — it only runs the conversion when the
 * column is still `varchar`, so it is a no-op on any database already at `jsonb`
 * (e.g. a fresh local DB built from the initial migration).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'consent'
          AND column_name = 'text'
          AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "consent" ALTER COLUMN "text" TYPE jsonb USING "text"::jsonb;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'consent'
          AND column_name = 'text'
          AND data_type = 'jsonb'
      ) THEN
        ALTER TABLE "consent" ALTER COLUMN "text" TYPE varchar USING "text"::text;
      END IF;
    END $$;
  `)
}
