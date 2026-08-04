import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "state_deputy_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaign_user_id" integer
  );
  
  ALTER TABLE "state_deputy_rels" ADD CONSTRAINT "state_deputy_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."state_deputy"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "state_deputy_rels" ADD CONSTRAINT "state_deputy_rels_campaign_user_fk" FOREIGN KEY ("campaign_user_id") REFERENCES "public"."campaign_user"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "state_deputy_rels_order_idx" ON "state_deputy_rels" USING btree ("order");
  CREATE INDEX "state_deputy_rels_parent_idx" ON "state_deputy_rels" USING btree ("parent_id");
  CREATE INDEX "state_deputy_rels_path_idx" ON "state_deputy_rels" USING btree ("path");
  CREATE INDEX "state_deputy_rels_campaign_user_id_idx" ON "state_deputy_rels" USING btree ("campaign_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "state_deputy_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "state_deputy_rels" CASCADE;`)
}
