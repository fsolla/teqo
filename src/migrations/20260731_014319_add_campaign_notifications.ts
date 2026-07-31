import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notification_type" AS ENUM('municipality_update', 'new_supporter', 'activity_attention', 'invite_accepted');
  CREATE TABLE "notification" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"recipient_id" integer NOT NULL,
  	"type" "enum_notification_type" NOT NULL,
  	"payload" jsonb NOT NULL,
  	"municipality_id" integer,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_subscription" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"p256dh" varchar NOT NULL,
  	"auth" varchar NOT NULL,
  	"expiration_time" numeric,
  	"consent_id" integer NOT NULL,
  	"consent_content_hash" varchar NOT NULL,
  	"consented_at" timestamp(3) with time zone NOT NULL,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscription_id" integer;
  ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_campaign_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification" ADD CONSTRAINT "notification_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_campaign_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_consent_id_consent_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notification_recipient_idx" ON "notification" USING btree ("recipient_id");
  CREATE INDEX "notification_type_idx" ON "notification" USING btree ("type");
  CREATE INDEX "notification_municipality_idx" ON "notification" USING btree ("municipality_id");
  CREATE INDEX "notification_read_at_idx" ON "notification" USING btree ("read_at");
  CREATE INDEX "notification_updated_at_idx" ON "notification" USING btree ("updated_at");
  CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");
  CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");
  CREATE UNIQUE INDEX "push_subscription_endpoint_idx" ON "push_subscription" USING btree ("endpoint");
  CREATE INDEX "push_subscription_consent_idx" ON "push_subscription" USING btree ("consent_id");
  CREATE INDEX "push_subscription_updated_at_idx" ON "push_subscription" USING btree ("updated_at");
  CREATE INDEX "push_subscription_created_at_idx" ON "push_subscription" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscription_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."push_subscription"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_notification_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscription_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscription_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notification" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_subscription" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notification" CASCADE;
  DROP TABLE "push_subscription" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_subscription_fk";
  
  DROP INDEX "payload_locked_documents_rels_notification_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_subscription_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_subscription_id";
  DROP TYPE "public"."enum_notification_type";`)
}
