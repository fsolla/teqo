import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "tracking_facebook_pixel_id" varchar;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_tracking_facebook_pixel_id" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "tracking_facebook_pixel_id";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_tracking_facebook_pixel_id";`)
}
