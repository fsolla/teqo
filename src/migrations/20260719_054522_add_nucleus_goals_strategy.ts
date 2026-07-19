import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_electoral_nucleus_priority" AS ENUM('alta', 'normal');
  ALTER TABLE "electoral_nucleus" ADD COLUMN "dobradinha_notes" varchar;
  ALTER TABLE "electoral_nucleus" ADD COLUMN "next_steps" varchar;
  ALTER TABLE "electoral_nucleus" ADD COLUMN "vote_goals_good" numeric;
  ALTER TABLE "electoral_nucleus" ADD COLUMN "vote_goals_regular" numeric;
  ALTER TABLE "electoral_nucleus" ADD COLUMN "vote_goals_minimum" numeric;
  ALTER TABLE "electoral_nucleus" ADD COLUMN "priority" "enum_electoral_nucleus_priority" DEFAULT 'normal';
  CREATE INDEX "electoral_nucleus_priority_idx" ON "electoral_nucleus" USING btree ("priority");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "electoral_nucleus_priority_idx";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "dobradinha_notes";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "next_steps";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "vote_goals_good";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "vote_goals_regular";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "vote_goals_minimum";
  ALTER TABLE "electoral_nucleus" DROP COLUMN "priority";
  DROP TYPE "public"."enum_electoral_nucleus_priority";`)
}
