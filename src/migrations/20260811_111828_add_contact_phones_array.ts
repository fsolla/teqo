import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-edited on top of the generated statements: the generator re-emitted
// `campaign_user.contact_id` / `leadership_rels.campaign_user_id` because the
// 20260809_204728 snapshot (.json) does not reflect its hand-written SQL —
// those columns already exist in every environment (C99/C100). Kept here: the
// `contact_phones` join table (order = priority, index on `value`), a backfill
// of the existing single `phone` into `phones[0]` BEFORE the column drops, and
// the drop of `contact.phone` (+ its index). Production holds real PII: the
// backfill is lossless, the drop happens only after it.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "contact_phones" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "contact_phones_order_idx" ON "contact_phones" USING btree ("_order");
  CREATE INDEX "contact_phones_parent_id_idx" ON "contact_phones" USING btree ("_parent_id");
  CREATE INDEX "contact_phones_value_idx" ON "contact_phones" USING btree ("value");
  INSERT INTO "contact_phones" ("id", "_parent_id", "_order", "value")
    SELECT gen_random_uuid()::text, "id", 0, "phone" FROM "contact" WHERE "phone" IS NOT NULL;
  DROP INDEX "contact_phone_idx";
  ALTER TABLE "contact" DROP COLUMN "phone";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Rollback is lossy BY DESIGN: only the primary (`_order` 0) is restored to
  // `contact.phone` — every appended number is discarded. Rollbacks are
  // best-effort here (C111-era policy); the forward path is lossless.
  await db.execute(sql`
   ALTER TABLE "contact" ADD COLUMN "phone" varchar;
  UPDATE "contact" SET "phone" = "contact_phones"."value"
    FROM "contact_phones" WHERE "contact_phones"."_parent_id" = "contact"."id" AND "contact_phones"."_order" = 0;
  CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone");
  ALTER TABLE "contact_phones" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contact_phones" CASCADE;`)
}
