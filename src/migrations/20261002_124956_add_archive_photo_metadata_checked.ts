import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "archive_photo" ADD COLUMN "catalog_metadata_checked_at" timestamp(3) with time zone;
  CREATE INDEX "archive_photo_catalog_catalog_metadata_checked_at_idx" ON "archive_photo" USING btree ("catalog_metadata_checked_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "archive_photo_catalog_catalog_metadata_checked_at_idx";
  ALTER TABLE "archive_photo" DROP COLUMN "catalog_metadata_checked_at";`)
}
