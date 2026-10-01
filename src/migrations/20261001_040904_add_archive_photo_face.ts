import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "archive_photo_face" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"photo_id" integer NOT NULL,
  	"model" varchar NOT NULL,
  	"detected_at" timestamp(3) with time zone,
  	"vector" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "face_subject" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "face_subject_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_face_subject_fk";
  DROP INDEX "payload_locked_documents_rels_face_subject_id_idx";
  DROP TABLE "face_subject" CASCADE;
  DROP TABLE "face_subject_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "archive_photo_face_id" integer;
  ALTER TABLE "archive_photo_face" ADD CONSTRAINT "archive_photo_face_photo_id_archive_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "archive_photo_face_photo_idx" ON "archive_photo_face" USING btree ("photo_id");
  CREATE INDEX "archive_photo_face_model_idx" ON "archive_photo_face" USING btree ("model");
  CREATE INDEX "archive_photo_face_updated_at_idx" ON "archive_photo_face" USING btree ("updated_at");
  CREATE INDEX "archive_photo_face_created_at_idx" ON "archive_photo_face" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_archive_photo_face_fk" FOREIGN KEY ("archive_photo_face_id") REFERENCES "public"."archive_photo_face"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_archive_photo_face_id_idx" ON "payload_locked_documents_rels" USING btree ("archive_photo_face_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "face_subject_id";
  DROP TYPE "public"."enum_face_subject_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_face_subject_status" AS ENUM('active', 'removed');
  CREATE TABLE "face_subject" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"consent_id" integer NOT NULL,
  	"consent_hash" varchar,
  	"model" varchar,
  	"enrolled_at" timestamp(3) with time zone,
  	"vector" jsonb,
  	"status" "enum_face_subject_status" DEFAULT 'active' NOT NULL,
  	"removed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "face_subject_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"archive_photo_id" integer
  );
  
  ALTER TABLE "archive_photo_face" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_archive_photo_face_fk";
  DROP INDEX "payload_locked_documents_rels_archive_photo_face_id_idx";
  DROP TABLE "archive_photo_face" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "face_subject_id" integer;
  ALTER TABLE "face_subject" ADD CONSTRAINT "face_subject_consent_id_consent_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "face_subject_rels" ADD CONSTRAINT "face_subject_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."face_subject"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "face_subject_rels" ADD CONSTRAINT "face_subject_rels_archive_photo_fk" FOREIGN KEY ("archive_photo_id") REFERENCES "public"."archive_photo"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "face_subject_consent_idx" ON "face_subject" USING btree ("consent_id");
  CREATE INDEX "face_subject_status_idx" ON "face_subject" USING btree ("status");
  CREATE INDEX "face_subject_updated_at_idx" ON "face_subject" USING btree ("updated_at");
  CREATE INDEX "face_subject_created_at_idx" ON "face_subject" USING btree ("created_at");
  CREATE INDEX "face_subject_rels_order_idx" ON "face_subject_rels" USING btree ("order");
  CREATE INDEX "face_subject_rels_parent_idx" ON "face_subject_rels" USING btree ("parent_id");
  CREATE INDEX "face_subject_rels_path_idx" ON "face_subject_rels" USING btree ("path");
  CREATE INDEX "face_subject_rels_archive_photo_id_idx" ON "face_subject_rels" USING btree ("archive_photo_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_face_subject_fk" FOREIGN KEY ("face_subject_id") REFERENCES "public"."face_subject"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_face_subject_id_idx" ON "payload_locked_documents_rels" USING btree ("face_subject_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "archive_photo_face_id";`)
}
