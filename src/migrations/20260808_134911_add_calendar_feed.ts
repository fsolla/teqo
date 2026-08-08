import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "calendar_feed" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"secret_slug" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"filter_municipality_id" integer,
  	"filter_deputy_present" boolean DEFAULT false,
  	"filter_tag" varchar,
  	"revoked_at" timestamp(3) with time zone,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "calendar_feed_id" integer;
  ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_filter_municipality_id_municipality_id_fk" FOREIGN KEY ("filter_municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_created_by_id_campaign_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "calendar_feed_secret_slug_idx" ON "calendar_feed" USING btree ("secret_slug");
  CREATE INDEX "calendar_feed_filter_municipality_idx" ON "calendar_feed" USING btree ("filter_municipality_id");
  CREATE INDEX "calendar_feed_revoked_at_idx" ON "calendar_feed" USING btree ("revoked_at");
  CREATE INDEX "calendar_feed_created_by_idx" ON "calendar_feed" USING btree ("created_by_id");
  CREATE INDEX "calendar_feed_updated_at_idx" ON "calendar_feed" USING btree ("updated_at");
  CREATE INDEX "calendar_feed_created_at_idx" ON "calendar_feed" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_calendar_feed_fk" FOREIGN KEY ("calendar_feed_id") REFERENCES "public"."calendar_feed"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_calendar_feed_id_idx" ON "payload_locked_documents_rels" USING btree ("calendar_feed_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "calendar_feed" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "calendar_feed" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_calendar_feed_fk";
  
  DROP INDEX "payload_locked_documents_rels_calendar_feed_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "calendar_feed_id";`)
}
