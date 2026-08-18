import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "social_feed_settings" ADD COLUMN "instagram_enabled" boolean DEFAULT true;
  ALTER TABLE "social_feed_settings" ADD COLUMN "instagram_access_token" varchar;
  ALTER TABLE "social_feed_settings" ADD COLUMN "instagram_user_id" varchar;
  ALTER TABLE "social_feed_settings" ADD COLUMN "instagram_max_items" numeric DEFAULT 3;
  ALTER TABLE "social_feed_settings" ADD COLUMN "instagram_feed_snapshot" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "social_feed_settings" DROP COLUMN "instagram_enabled";
  ALTER TABLE "social_feed_settings" DROP COLUMN "instagram_access_token";
  ALTER TABLE "social_feed_settings" DROP COLUMN "instagram_user_id";
  ALTER TABLE "social_feed_settings" DROP COLUMN "instagram_max_items";
  ALTER TABLE "social_feed_settings" DROP COLUMN "instagram_feed_snapshot";`)
}
