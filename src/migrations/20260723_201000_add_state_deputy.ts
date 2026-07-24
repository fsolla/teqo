import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "state_deputy" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "party" varchar,
      "notes" varchar,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "state_deputy" ADD CONSTRAINT "state_deputy_created_by_id_campaign_user_id_fk"
      FOREIGN KEY ("created_by_id") REFERENCES "public"."campaign_user"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE UNIQUE INDEX "state_deputy_name_idx" ON "state_deputy" USING btree ("name");
    CREATE UNIQUE INDEX "state_deputy_slug_idx" ON "state_deputy" USING btree ("slug");
    CREATE INDEX "state_deputy_party_idx" ON "state_deputy" USING btree ("party");
    CREATE INDEX "state_deputy_created_by_idx" ON "state_deputy" USING btree ("created_by_id");
    CREATE INDEX "state_deputy_updated_at_idx" ON "state_deputy" USING btree ("updated_at");
    CREATE INDEX "state_deputy_created_at_idx" ON "state_deputy" USING btree ("created_at");

    ALTER TABLE "municipality_rels" ADD COLUMN "state_deputy_id" integer;
    ALTER TABLE "leadership_rels" ADD COLUMN "state_deputy_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "state_deputy_id" integer;

    ALTER TABLE "municipality_rels" ADD CONSTRAINT "municipality_rels_state_deputy_fk"
      FOREIGN KEY ("state_deputy_id") REFERENCES "public"."state_deputy"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "leadership_rels" ADD CONSTRAINT "leadership_rels_state_deputy_fk"
      FOREIGN KEY ("state_deputy_id") REFERENCES "public"."state_deputy"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_state_deputy_fk"
      FOREIGN KEY ("state_deputy_id") REFERENCES "public"."state_deputy"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "municipality_rels_state_deputy_id_idx" ON "municipality_rels" USING btree ("state_deputy_id");
    CREATE INDEX "leadership_rels_state_deputy_id_idx" ON "leadership_rels" USING btree ("state_deputy_id");
    CREATE INDEX "payload_locked_documents_rels_state_deputy_id_idx" ON "payload_locked_documents_rels" USING btree ("state_deputy_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "municipality_rels" DROP CONSTRAINT IF EXISTS "municipality_rels_state_deputy_fk";
    ALTER TABLE "leadership_rels" DROP CONSTRAINT IF EXISTS "leadership_rels_state_deputy_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_state_deputy_fk";

    DROP INDEX IF EXISTS "municipality_rels_state_deputy_id_idx";
    DROP INDEX IF EXISTS "leadership_rels_state_deputy_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_state_deputy_id_idx";

    ALTER TABLE "municipality_rels" DROP COLUMN IF EXISTS "state_deputy_id";
    ALTER TABLE "leadership_rels" DROP COLUMN IF EXISTS "state_deputy_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "state_deputy_id";

    DROP TABLE IF EXISTS "state_deputy" CASCADE;
  `)
}
