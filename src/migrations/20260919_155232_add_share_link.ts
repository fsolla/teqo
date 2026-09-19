import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "share_link" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"destination" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"image_id" integer,
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "share_link_id" integer;
  ALTER TABLE "share_link" ADD CONSTRAINT "share_link_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "share_link_slug_idx" ON "share_link" USING btree ("slug");
  CREATE INDEX "share_link_image_idx" ON "share_link" USING btree ("image_id");
  CREATE INDEX "share_link_updated_at_idx" ON "share_link" USING btree ("updated_at");
  CREATE INDEX "share_link_created_at_idx" ON "share_link" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_share_link_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_link"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_share_link_id_idx" ON "payload_locked_documents_rels" USING btree ("share_link_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "share_link" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "share_link" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_share_link_fk";
  
  DROP INDEX "payload_locked_documents_rels_share_link_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "share_link_id";`)
}
