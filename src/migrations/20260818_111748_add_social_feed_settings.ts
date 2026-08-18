import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_social_feed_settings_excluded_items_platform" AS ENUM('youtube', 'instagram');
  CREATE TABLE "social_feed_settings_excluded_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_social_feed_settings_excluded_items_platform" NOT NULL,
  	"item_id" varchar NOT NULL,
  	"reason" varchar
  );

  CREATE TABLE "social_feed_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"youtube_enabled" boolean DEFAULT true,
  	"youtube_api_key" varchar,
  	"youtube_channel_id" varchar,
  	"youtube_max_items" numeric DEFAULT 3,
  	"youtube_feed_snapshot" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  ALTER TABLE "social_feed_settings_excluded_items" ADD CONSTRAINT "social_feed_settings_excluded_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."social_feed_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "social_feed_settings_excluded_items_order_idx" ON "social_feed_settings_excluded_items" USING btree ("_order");
  CREATE INDEX "social_feed_settings_excluded_items_parent_id_idx" ON "social_feed_settings_excluded_items" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "social_feed_settings_excluded_items" CASCADE;
  DROP TABLE "social_feed_settings" CASCADE;
  DROP TYPE "public"."enum_social_feed_settings_excluded_items_platform";`)
}
