import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_share_link_mode" AS ENUM('direct', 'announcement');
  CREATE TABLE "share_link_destinations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"live" boolean DEFAULT false
  );
  
  ALTER TABLE "share_link" ADD COLUMN "mode" "enum_share_link_mode" DEFAULT 'direct' NOT NULL;
  ALTER TABLE "share_link" ADD COLUMN "starts_at" timestamp(3) with time zone;
  ALTER TABLE "share_link" ADD COLUMN "ends_at" timestamp(3) with time zone;
  ALTER TABLE "share_link" ADD COLUMN "location" varchar;
  ALTER TABLE "share_link_destinations" ADD CONSTRAINT "share_link_destinations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."share_link"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "share_link_destinations_order_idx" ON "share_link_destinations" USING btree ("_order");
  CREATE INDEX "share_link_destinations_parent_id_idx" ON "share_link_destinations" USING btree ("_parent_id");
  
  -- S29 backfill (hand-written): every legacy link becomes a direct link with
  -- its old destination pre-registered and on air — lossless before the drop.
  INSERT INTO "share_link_destinations" ("_order", "_parent_id", "id", "label", "url", "live")
  SELECT 0, "id", gen_random_uuid()::text, 'Destino', "destination", true
  FROM "share_link"
  WHERE "destination" IS NOT NULL AND "destination" <> '';
  
  ALTER TABLE "share_link" DROP COLUMN "destination";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Lossy by policy (precedent: contact_phones): the pool has no single scalar
  // equivalent, so the live destination (fallback: first row) comes back as the
  // old destination column; announcement-only links lose the pre-broadcast state.
  await db.execute(sql`
   ALTER TABLE "share_link" ADD COLUMN "destination" varchar;
  UPDATE "share_link" AS link
  SET "destination" = COALESCE(
    (
      SELECT destination."url"
      FROM "share_link_destinations" AS destination
      WHERE destination."_parent_id" = link."id"
      ORDER BY destination."live" DESC NULLS LAST, destination."_order" ASC
      LIMIT 1
    ),
    ''
  );
  ALTER TABLE "share_link" ALTER COLUMN "destination" SET NOT NULL;
  DROP TABLE "share_link_destinations" CASCADE;
  ALTER TABLE "share_link" DROP COLUMN "mode";
  ALTER TABLE "share_link" DROP COLUMN "starts_at";
  ALTER TABLE "share_link" DROP COLUMN "ends_at";
  ALTER TABLE "share_link" DROP COLUMN "location";
  DROP TYPE "public"."enum_share_link_mode";`)
}
