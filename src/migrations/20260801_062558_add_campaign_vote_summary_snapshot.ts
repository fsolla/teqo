import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "campaign_vote_summary_snapshot" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" timestamp(3) with time zone NOT NULL,
  	"scope_key" varchar DEFAULT 'statewide' NOT NULL,
  	"staff_vote_total_central" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_vote_summary_snapshot_id" integer;
  CREATE INDEX "campaign_vote_summary_snapshot_day_idx" ON "campaign_vote_summary_snapshot" USING btree ("day");
  CREATE INDEX "campaign_vote_summary_snapshot_scope_key_idx" ON "campaign_vote_summary_snapshot" USING btree ("scope_key");
  CREATE INDEX "campaign_vote_summary_snapshot_updated_at_idx" ON "campaign_vote_summary_snapshot" USING btree ("updated_at");
  CREATE INDEX "campaign_vote_summary_snapshot_created_at_idx" ON "campaign_vote_summary_snapshot" USING btree ("created_at");
  CREATE UNIQUE INDEX "day_scopeKey_idx" ON "campaign_vote_summary_snapshot" USING btree ("day","scope_key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_vote_summary_snaps_fk" FOREIGN KEY ("campaign_vote_summary_snapshot_id") REFERENCES "public"."campaign_vote_summary_snapshot"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_campaign_vote_summary_snap_idx" ON "payload_locked_documents_rels" USING btree ("campaign_vote_summary_snapshot_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_vote_summary_snapshot" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "campaign_vote_summary_snapshot" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_vote_summary_snaps_fk";
  
  DROP INDEX "payload_locked_documents_rels_campaign_vote_summary_snap_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_vote_summary_snapshot_id";`)
}
