import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_leadership_support_status" ADD VALUE 'lembranca' BEFORE 'negativo';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leadership" ALTER COLUMN "support_status" SET DATA TYPE text;
  ALTER TABLE "leadership" ALTER COLUMN "support_status" SET DEFAULT 'a_abordar'::text;
  DROP TYPE "public"."enum_leadership_support_status";
  CREATE TYPE "public"."enum_leadership_support_status" AS ENUM('engajado', 'a_abordar', 'em_disputa', 'negativo');
  ALTER TABLE "leadership" ALTER COLUMN "support_status" SET DEFAULT 'a_abordar'::"public"."enum_leadership_support_status";
  ALTER TABLE "leadership" ALTER COLUMN "support_status" SET DATA TYPE "public"."enum_leadership_support_status" USING "support_status"::"public"."enum_leadership_support_status";`)
}
