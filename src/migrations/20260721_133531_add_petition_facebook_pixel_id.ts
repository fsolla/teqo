import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "petition" ADD COLUMN "tracking_facebook_pixel_id" varchar;
  ALTER TABLE "_petition_v" ADD COLUMN "version_tracking_facebook_pixel_id" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "petition" DROP COLUMN "tracking_facebook_pixel_id";
  ALTER TABLE "_petition_v" DROP COLUMN "version_tracking_facebook_pixel_id";`)
}
