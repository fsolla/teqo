import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "campaign_user_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "campaign_user" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_user_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "campaign_user_id" integer;
  ALTER TABLE "campaign_user_sessions" ADD CONSTRAINT "campaign_user_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "campaign_user_sessions_order_idx" ON "campaign_user_sessions" USING btree ("_order");
  CREATE INDEX "campaign_user_sessions_parent_id_idx" ON "campaign_user_sessions" USING btree ("_parent_id");
  CREATE INDEX "campaign_user_updated_at_idx" ON "campaign_user" USING btree ("updated_at");
  CREATE INDEX "campaign_user_created_at_idx" ON "campaign_user" USING btree ("created_at");
  CREATE UNIQUE INDEX "campaign_user_email_idx" ON "campaign_user" USING btree ("email");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_campaign_user_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_user_id");
  CREATE INDEX "payload_preferences_rels_campaign_user_id_idx" ON "payload_preferences_rels" USING btree ("campaign_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_user_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_user" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "campaign_user_sessions" CASCADE;
  DROP TABLE "campaign_user" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_user_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_campaign_user_fk";
  
  DROP INDEX "payload_locked_documents_rels_campaign_user_id_idx";
  DROP INDEX "payload_preferences_rels_campaign_user_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_user_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "campaign_user_id";`)
}
