import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity" DROP CONSTRAINT "activity_responsible_id_contact_id_fk";
  
  ALTER TABLE "activity" DROP CONSTRAINT "activity_leadership_id_leadership_id_fk";
  
  DROP INDEX "activity_responsible_idx";
  DROP INDEX "activity_leadership_idx";
  ALTER TABLE "activity_rels" ADD COLUMN "leadership_id" integer;
  ALTER TABLE "activity_rels" ADD COLUMN "state_deputy_id" integer;
  ALTER TABLE "activity_rels" ADD CONSTRAINT "activity_rels_leadership_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_rels" ADD CONSTRAINT "activity_rels_state_deputy_fk" FOREIGN KEY ("state_deputy_id") REFERENCES "public"."state_deputy"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_rels_leadership_id_idx" ON "activity_rels" USING btree ("leadership_id");
  CREATE INDEX "activity_rels_state_deputy_id_idx" ON "activity_rels" USING btree ("state_deputy_id");

  -- C90 data reconciliation (must run before the columns are dropped).
  -- 1) The old advisors (staff hasMany) rows move to the single responsible path.
  UPDATE "activity_rels"
  SET "path" = 'responsible'
  WHERE "path" = 'advisors' AND "campaign_user_id" IS NOT NULL;

  -- 2) Each old activity.leadership_id becomes a responsible row.
  INSERT INTO "activity_rels" ("parent_id", "path", "order", "leadership_id")
  SELECT a."id", 'responsible', COALESCE(m.max_order + 1, 1), a."leadership_id"
  FROM "activity" a
  LEFT JOIN (
    SELECT r."parent_id", max(r."order") AS max_order
    FROM "activity_rels" r
    WHERE r."path" = 'responsible'
    GROUP BY r."parent_id"
  ) m ON m."parent_id" = a."id"
  WHERE a."leadership_id" IS NOT NULL;

  -- 3) Renumber responsible rows sequentially per parent so sparse orders
  --    left by the migration never confuse reading.
  UPDATE "activity_rels" r
  SET "order" = t.new_order
  FROM (
    SELECT r2."id", r2."parent_id", row_number() OVER (
      PARTITION BY r2."parent_id" ORDER BY r2."order", r2."id"
    ) AS new_order
    FROM "activity_rels" r2
    WHERE r2."path" = 'responsible'
  ) t
  WHERE r."id" = t."id";

  -- 4) The old responsible (Contact) has no valid type in the new union;
  --    C90 gate decided to discard it. Surface the count at deploy time.
  DO $$
  DECLARE contacts_dropped integer;
  BEGIN
    SELECT count(*) INTO contacts_dropped FROM "activity" WHERE "responsible_id" IS NOT NULL;
    RAISE NOTICE 'remodel_activity_responsible: descartando % responsável(is) Contact antigo(s)', contacts_dropped;
  END $$;

  ALTER TABLE "activity" DROP COLUMN "responsible_id";
  ALTER TABLE "activity" DROP COLUMN "leadership_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_rels" DROP CONSTRAINT "activity_rels_leadership_fk";
  
  ALTER TABLE "activity_rels" DROP CONSTRAINT "activity_rels_state_deputy_fk";
  
  DROP INDEX "activity_rels_leadership_id_idx";
  DROP INDEX "activity_rels_state_deputy_id_idx";
  ALTER TABLE "activity" ADD COLUMN "responsible_id" integer;
  ALTER TABLE "activity" ADD COLUMN "leadership_id" integer;
  ALTER TABLE "activity" ADD CONSTRAINT "activity_responsible_id_contact_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity" ADD CONSTRAINT "activity_leadership_id_leadership_id_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_responsible_idx" ON "activity" USING btree ("responsible_id");
  CREATE INDEX "activity_leadership_idx" ON "activity" USING btree ("leadership_id");
  ALTER TABLE "activity_rels" DROP COLUMN "leadership_id";
  ALTER TABLE "activity_rels" DROP COLUMN "state_deputy_id";`)
}
