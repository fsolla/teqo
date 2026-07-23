import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vote_pledge" ADD COLUMN "estimated_votes_pessimistic" numeric;
    ALTER TABLE "vote_pledge" ADD COLUMN "estimated_votes_central" numeric;
    ALTER TABLE "vote_pledge" ADD COLUMN "estimated_votes_optimistic" numeric;

    UPDATE "vote_pledge"
    SET "estimated_votes_central" = "estimated_votes"
    WHERE "estimated_votes" IS NOT NULL;

    DROP INDEX IF EXISTS "vote_pledge_estimated_votes_idx";
    ALTER TABLE "vote_pledge" DROP COLUMN "estimated_votes";

    ALTER TABLE "plaza" ADD COLUMN "expected_votes_pessimistic" numeric;
    ALTER TABLE "plaza" ADD COLUMN "expected_votes_central" numeric;
    ALTER TABLE "plaza" ADD COLUMN "expected_votes_optimistic" numeric;

    UPDATE "plaza"
    SET "expected_votes_central" = "expected_votes"
    WHERE "expected_votes" IS NOT NULL;

    ALTER TABLE "plaza" DROP COLUMN "expected_votes";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vote_pledge" ADD COLUMN "estimated_votes" numeric;
    UPDATE "vote_pledge"
    SET "estimated_votes" = "estimated_votes_central"
    WHERE "estimated_votes_central" IS NOT NULL;
  `)
  await db.execute(sql`
    ALTER TABLE "vote_pledge" DROP COLUMN "estimated_votes_pessimistic";
    ALTER TABLE "vote_pledge" DROP COLUMN "estimated_votes_central";
    ALTER TABLE "vote_pledge" DROP COLUMN "estimated_votes_optimistic";
    CREATE INDEX "vote_pledge_estimated_votes_idx" ON "vote_pledge" USING btree ("estimated_votes");
  `)
  await db.execute(sql`
    ALTER TABLE "plaza" ADD COLUMN "expected_votes" numeric;
    UPDATE "plaza"
    SET "expected_votes" = "expected_votes_central"
    WHERE "expected_votes_central" IS NOT NULL;
    ALTER TABLE "plaza" DROP COLUMN "expected_votes_pessimistic";
    ALTER TABLE "plaza" DROP COLUMN "expected_votes_central";
    ALTER TABLE "plaza" DROP COLUMN "expected_votes_optimistic";
  `)
}
