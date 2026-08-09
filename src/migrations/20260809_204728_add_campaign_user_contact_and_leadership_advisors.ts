import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_user" ADD COLUMN "contact_id" integer;
  ALTER TABLE "leadership_rels" ADD COLUMN "campaign_user_id" integer;
  ALTER TABLE "campaign_user" ADD CONSTRAINT "campaign_user_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leadership_rels" ADD CONSTRAINT "leadership_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "campaign_user_contact_idx" ON "campaign_user" USING btree ("contact_id");
  CREATE INDEX "leadership_rels_campaign_user_id_idx" ON "leadership_rels" USING btree ("campaign_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_user" DROP CONSTRAINT "campaign_user_contact_id_contact_id_fk";
  
  ALTER TABLE "leadership_rels" DROP CONSTRAINT "leadership_rels_campaign_user_fk";
  
  DROP INDEX "campaign_user_contact_idx";
  DROP INDEX "leadership_rels_campaign_user_id_idx";
  ALTER TABLE "campaign_user" DROP COLUMN "contact_id";
  ALTER TABLE "leadership_rels" DROP COLUMN "campaign_user_id";`)
}
