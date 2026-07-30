import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "leadership_sector_idx";
  ALTER TABLE "leadership" DROP COLUMN "sector";
  ALTER TABLE "leadership" DROP COLUMN "sector_notes";
  ALTER TABLE "leadership" DROP COLUMN "consent_note";
  DROP TYPE "public"."enum_leadership_sector";
  ALTER TABLE "leadership" ADD COLUMN "exclusive" boolean DEFAULT true NOT NULL;
  CREATE INDEX "leadership_exclusive_idx" ON "leadership" USING btree ("exclusive");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "leadership_exclusive_idx";
  ALTER TABLE "leadership" DROP COLUMN "exclusive";
  CREATE TYPE "public"."enum_leadership_sector" AS ENUM('religioso', 'sindical', 'comunitario', 'rural', 'empresarial', 'juventude', 'saude', 'educacao', 'cultura', 'outro');
  ALTER TABLE "leadership" ADD COLUMN "sector" "enum_leadership_sector";
  ALTER TABLE "leadership" ADD COLUMN "sector_notes" varchar;
  ALTER TABLE "leadership" ADD COLUMN "consent_note" varchar;
  CREATE INDEX "leadership_sector_idx" ON "leadership" USING btree ("sector");`)
}
