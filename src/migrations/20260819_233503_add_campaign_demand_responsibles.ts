import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_demand_rels" ADD COLUMN "campaign_user_id" integer;
  ALTER TABLE "campaign_demand_rels" ADD CONSTRAINT "campaign_demand_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "campaign_demand_rels_campaign_user_id_idx" ON "campaign_demand_rels" USING btree ("campaign_user_id");
  
  -- C143 backfill: pre-existing demands keep their creator as responsible, so
  -- the explicit-responsible rule does not hide a demand from its own author.
  DO $$
  DECLARE backfilled integer;
  BEGIN
    INSERT INTO "campaign_demand_rels" ("order", "parent_id", "path", "campaign_user_id")
    SELECT 0, "id", 'responsibles', "created_by_id"
    FROM "campaign_demand"
    WHERE "created_by_id" IS NOT NULL;
    GET DIAGNOSTICS backfilled = ROW_COUNT;
    RAISE NOTICE 'add_campaign_demand_responsibles: backfilling % demanda(s) com o criador como responsável', backfilled;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_demand_rels" DROP CONSTRAINT "campaign_demand_rels_campaign_user_fk";
  
  DROP INDEX "campaign_demand_rels_campaign_user_id_idx";
  ALTER TABLE "campaign_demand_rels" DROP COLUMN "campaign_user_id";`)
}
