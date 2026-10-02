import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "face_figure_references" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"vector" jsonb,
  	"model" varchar,
  	"source" varchar NOT NULL,
  	"added_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "face_figure" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"full_name" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "face_figure_id" integer;
  ALTER TABLE "face_figure_references" ADD CONSTRAINT "face_figure_references_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."face_figure"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "face_figure_references_order_idx" ON "face_figure_references" USING btree ("_order");
  CREATE INDEX "face_figure_references_parent_id_idx" ON "face_figure_references" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "face_figure_name_idx" ON "face_figure" USING btree ("name");
  CREATE UNIQUE INDEX "face_figure_slug_idx" ON "face_figure" USING btree ("slug");
  CREATE INDEX "face_figure_active_idx" ON "face_figure" USING btree ("active");
  CREATE INDEX "face_figure_updated_at_idx" ON "face_figure" USING btree ("updated_at");
  CREATE INDEX "face_figure_created_at_idx" ON "face_figure" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_face_figure_fk" FOREIGN KEY ("face_figure_id") REFERENCES "public"."face_figure"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_face_figure_id_idx" ON "payload_locked_documents_rels" USING btree ("face_figure_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "face_figure_references" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "face_figure" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_face_figure_fk";
  DROP INDEX "payload_locked_documents_rels_face_figure_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "face_figure_id";
  DROP TABLE "face_figure_references" CASCADE;
  DROP TABLE "face_figure" CASCADE;`)
}
