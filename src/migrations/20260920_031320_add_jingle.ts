import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "jingle" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"cover_image_id" integer NOT NULL,
  	"audio_id" integer NOT NULL,
  	"order" numeric,
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "jingle_id" integer;
  ALTER TABLE "jingle" ADD CONSTRAINT "jingle_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jingle" ADD CONSTRAINT "jingle_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "jingle_slug_idx" ON "jingle" USING btree ("slug");
  CREATE INDEX "jingle_cover_image_idx" ON "jingle" USING btree ("cover_image_id");
  CREATE INDEX "jingle_audio_idx" ON "jingle" USING btree ("audio_id");
  CREATE INDEX "jingle_updated_at_idx" ON "jingle" USING btree ("updated_at");
  CREATE INDEX "jingle_created_at_idx" ON "jingle" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_jingle_fk" FOREIGN KEY ("jingle_id") REFERENCES "public"."jingle"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_jingle_id_idx" ON "payload_locked_documents_rels" USING btree ("jingle_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jingle" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "jingle" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_jingle_fk";
  
  DROP INDEX "payload_locked_documents_rels_jingle_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "jingle_id";`)
}
