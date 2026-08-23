import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "municipality_update_comments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer,
  	"created_at" timestamp(3) with time zone
  );

  ALTER TABLE "municipality_update" ADD COLUMN "responsible_id" integer;
  ALTER TABLE "municipality_update" ADD COLUMN "resolved_by_id" integer;
  ALTER TABLE "municipality_update" ADD COLUMN "resolved_at" timestamp(3) with time zone;
  ALTER TABLE "municipality_update_comments" ADD CONSTRAINT "municipality_update_comments_author_id_campaign_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipality_update_comments" ADD CONSTRAINT "municipality_update_comments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."municipality_update"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "municipality_update_comments_order_idx" ON "municipality_update_comments" USING btree ("_order");
  CREATE INDEX "municipality_update_comments_parent_id_idx" ON "municipality_update_comments" USING btree ("_parent_id");
  CREATE INDEX "municipality_update_comments_author_idx" ON "municipality_update_comments" USING btree ("author_id");
  ALTER TABLE "municipality_update" ADD CONSTRAINT "municipality_update_responsible_id_campaign_user_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "municipality_update" ADD CONSTRAINT "municipality_update_resolved_by_id_campaign_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."campaign_user"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "municipality_update_responsible_idx" ON "municipality_update" USING btree ("responsible_id");
  CREATE INDEX "municipality_update_resolved_by_idx" ON "municipality_update" USING btree ("resolved_by_id");
  CREATE INDEX "municipality_update_resolved_at_idx" ON "municipality_update" USING btree ("resolved_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "municipality_update_comments" CASCADE;
  ALTER TABLE "municipality_update" DROP CONSTRAINT "municipality_update_responsible_id_campaign_user_id_fk";
  
  ALTER TABLE "municipality_update" DROP CONSTRAINT "municipality_update_resolved_by_id_campaign_user_id_fk";
  
  DROP INDEX "municipality_update_responsible_idx";
  DROP INDEX "municipality_update_resolved_by_idx";
  DROP INDEX "municipality_update_resolved_at_idx";
  ALTER TABLE "municipality_update" DROP COLUMN "responsible_id";
  ALTER TABLE "municipality_update" DROP COLUMN "resolved_by_id";
  ALTER TABLE "municipality_update" DROP COLUMN "resolved_at";`)
}
