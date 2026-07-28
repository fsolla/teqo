import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_allocation_decision_outcome" ADD VALUE 'adiada';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "allocation_decision" ALTER COLUMN "outcome" SET DATA TYPE text;
  DROP TYPE "public"."enum_allocation_decision_outcome";
  CREATE TYPE "public"."enum_allocation_decision_outcome" AS ENUM('aceita', 'descarta', 'movimento');
  ALTER TABLE "allocation_decision" ALTER COLUMN "outcome" SET DATA TYPE "public"."enum_allocation_decision_outcome" USING "outcome"::"public"."enum_allocation_decision_outcome";`)
}
