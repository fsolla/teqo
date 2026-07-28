import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_municipality_engagement_level" AS ENUM('n0', 'n1', 'n2', 'n3', 'n4');
  ALTER TYPE "public"."enum_allocation_decision_outcome" ADD VALUE 'movimento';
  ALTER TABLE "municipality" ADD COLUMN "engagement_level" "enum_municipality_engagement_level";
  ALTER TABLE "municipality" ADD COLUMN "level_note" varchar;
  ALTER TABLE "municipality" ADD COLUMN "level_changed_at" timestamp(3) with time zone;
  CREATE INDEX "municipality_engagement_level_idx" ON "municipality" USING btree ("engagement_level");
  CREATE INDEX "municipality_level_changed_at_idx" ON "municipality" USING btree ("level_changed_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "allocation_decision" ALTER COLUMN "outcome" SET DATA TYPE text;
  DROP TYPE "public"."enum_allocation_decision_outcome";
  CREATE TYPE "public"."enum_allocation_decision_outcome" AS ENUM('aceita', 'descarta');
  ALTER TABLE "allocation_decision" ALTER COLUMN "outcome" SET DATA TYPE "public"."enum_allocation_decision_outcome" USING "outcome"::"public"."enum_allocation_decision_outcome";
  DROP INDEX "municipality_engagement_level_idx";
  DROP INDEX "municipality_level_changed_at_idx";
  ALTER TABLE "municipality" DROP COLUMN "engagement_level";
  ALTER TABLE "municipality" DROP COLUMN "level_note";
  ALTER TABLE "municipality" DROP COLUMN "level_changed_at";
  DROP TYPE "public"."enum_municipality_engagement_level";`)
}
