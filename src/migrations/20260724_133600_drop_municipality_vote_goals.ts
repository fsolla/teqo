import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Removes the duplicated "Metas de votos" (voteGoals) group from municipality.
 * The campaign works with a single scenario series — expectedVotes
 * (pessimista/média/otimista) — so any goals already entered are preserved as
 * estimates (Bom → otimista, Regular → média, Mínimo → pessimista); existing
 * estimates win on conflict. Idempotent: guarded on the column existing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'municipality'
          AND column_name = 'vote_goals_good'
      ) THEN
        UPDATE "municipality" SET
          "expected_votes_optimistic" = COALESCE("expected_votes_optimistic", "vote_goals_good"),
          "expected_votes_central" = COALESCE("expected_votes_central", "vote_goals_regular"),
          "expected_votes_pessimistic" = COALESCE("expected_votes_pessimistic", "vote_goals_minimum")
        WHERE "vote_goals_good" IS NOT NULL
           OR "vote_goals_regular" IS NOT NULL
           OR "vote_goals_minimum" IS NOT NULL;

        ALTER TABLE "municipality" DROP COLUMN "vote_goals_good";
        ALTER TABLE "municipality" DROP COLUMN "vote_goals_regular";
        ALTER TABLE "municipality" DROP COLUMN "vote_goals_minimum";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "municipality" ADD COLUMN IF NOT EXISTS "vote_goals_good" numeric;
    ALTER TABLE "municipality" ADD COLUMN IF NOT EXISTS "vote_goals_regular" numeric;
    ALTER TABLE "municipality" ADD COLUMN IF NOT EXISTS "vote_goals_minimum" numeric;
  `)
}
