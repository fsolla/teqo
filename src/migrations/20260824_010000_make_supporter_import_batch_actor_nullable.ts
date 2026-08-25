import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Reconciles production schema drift (drift C6, D13 / issue #643):
 * `supporter_import_batch.actor_id` was created as `integer NOT NULL` in
 * `20260719_011015_add_supporter_import_batch`, but its FK is `ON DELETE set
 * null` — a contradiction. Deleting a campaignUser that owns an unconsumed
 * batch failed with a not-null violation (23502) on the FK set-null UPDATE.
 *
 * C111 already made the delete safe at runtime via the
 * `deleteCampaignUserImportBatches` beforeDelete hook (and the hand-deletes in
 * `personDelete`/`personCapacityExit`), but the schema stayed contradictory.
 * This migration drops the NOT NULL so the column agrees with the `ON DELETE
 * set null` FK, matching the Payload config (`SupporterImportBatch.actor` is
 * now `required: false`). No schema cascade is introduced — the repo resolves
 * this class of cleanup with a hook, not a migration cascade (webauthn
 * precedent).
 *
 * Idempotent: only drops NOT NULL when the column is still NOT NULL, so it is a
 * no-op on any database already reconciled.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'supporter_import_batch'
          AND column_name = 'actor_id'
          AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE "supporter_import_batch" ALTER COLUMN "actor_id" DROP NOT NULL;
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
          AND table_name = 'supporter_import_batch'
          AND column_name = 'actor_id'
          AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE "supporter_import_batch" ALTER COLUMN "actor_id" SET NOT NULL;
      END IF;
    END $$;
  `)
}
