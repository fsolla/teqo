import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      affected integer;
    BEGIN
      UPDATE allocation_decision
      SET snapshot = snapshot - 'reversalSignals'
      WHERE outcome = 'movimento'
        AND snapshot ? 'reversalSignals';

      GET DIAGNOSTICS affected = ROW_COUNT;
      RAISE NOTICE 'strip_engagement_reversal_signals: removed reversalSignals from % row(s)', affected;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Historical reversal text was deliberately dropped (B134); it cannot be restored.
  await db.execute(sql`SELECT 1`)
}
