import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * E16 dossiê — staff-only `municipality.budgetNotes` (emendas aportadas,
 * manual-first per gap G11).
 *
 * The generated diff also wanted to CREATE TABLE "campaign_goals": that table
 * was added by the hand-written `20260724_180000_add_campaign_goals_global`
 * (which shipped without a drizzle snapshot), so the differ's "before" state
 * did not know it. The statement was removed here — the table already exists
 * everywhere that migration ran — while this migration's committed `.json`
 * snapshot now includes `campaign_goals`, healing the snapshot chain for
 * future generated migrations.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "municipality" ADD COLUMN "budget_notes" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "municipality" DROP COLUMN "budget_notes";`)
}
