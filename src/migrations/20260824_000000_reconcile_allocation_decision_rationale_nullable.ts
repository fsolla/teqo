import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Reconciles production schema drift: `allocation_decision.rationale` was created
 * as `varchar NOT NULL` in the foundation migration, but the Payload config
 * (`AllocationDecision.rationale.required`) was later set to `false` (B134).
 * Without this reconciliation, every `pnpm migrate:create` re-emits
 * `ALTER TABLE allocation_decision ALTER COLUMN rationale DROP NOT NULL`.
 *
 * This migration is idempotent — it only drops the constraint when the column
 * is still `NOT NULL`, so it is a no-op on any database already reconciled.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'allocation_decision'
          AND column_name = 'rationale'
          AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE "allocation_decision" ALTER COLUMN "rationale" DROP NOT NULL;
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
          AND table_name = 'allocation_decision'
          AND column_name = 'rationale'
          AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE "allocation_decision" ALTER COLUMN "rationale" SET NOT NULL;
      END IF;
    END $$;
  `)
}
