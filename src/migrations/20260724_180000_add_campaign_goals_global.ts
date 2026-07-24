import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `campaignGoals` global (E8 "conta da cadeira" — state-level vote
 * goal + margin used to decompose a per-municipality suggested goal).
 *
 * Hand-written rather than `migrate:create`-generated: the committed snapshot
 * chain has no `.json` for the last several migrations (2026-07-23/24 —
 * `add_vote_estimate_scenarios`, `remodel_municipalities`,
 * `add_state_deputy`, `reconcile_municipality_remodel`,
 * `drop_municipality_vote_goals`, `contact_phone_optional` all shipped
 * hand-written SQL without regenerating the drizzle-kit snapshot), so the
 * schema differ has no accurate "before" state for `municipality`/`contact`
 * and asks to disambiguate unrelated historical renames. This migration only
 * adds a brand-new table, so it's written directly following the pattern of
 * `20260719_054706_add_privacy_policy_global` (idempotent guard is
 * unnecessary — Payload never lets two migrations with the same name run
 * twice, and the table cannot already exist).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "campaign_goals" (
      "id" serial PRIMARY KEY NOT NULL,
      "state_goal" numeric NOT NULL,
      "margin" numeric,
      "base_year" numeric,
      "note" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "campaign_goals" CASCADE;
  `)
}
