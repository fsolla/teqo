import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_content_event_type" AS ENUM('abertura', 'download', 'compartilhar_whatsapp', 'compartilhar_link');
  CREATE TYPE "public"."enum_content_event_subject_type" AS ENUM('peca', 'card');
  CREATE TABLE "content_event" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_content_event_type" NOT NULL,
  	"subject_type" "enum_content_event_subject_type" NOT NULL,
  	"subject_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_event_id" integer;
  CREATE INDEX "content_event_updated_at_idx" ON "content_event" USING btree ("updated_at");
  CREATE INDEX "content_event_created_at_idx" ON "content_event" USING btree ("created_at");
  CREATE INDEX "subjectType_subjectId_type_idx" ON "content_event" USING btree ("subject_type","subject_id","type");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_event_fk" FOREIGN KEY ("content_event_id") REFERENCES "public"."content_event"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_content_event_id_idx" ON "payload_locked_documents_rels" USING btree ("content_event_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "content_event" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "content_event" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_content_event_fk";
  
  DROP INDEX "payload_locked_documents_rels_content_event_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_event_id";
  DROP TYPE "public"."enum_content_event_type";
  DROP TYPE "public"."enum_content_event_subject_type";`)
}
