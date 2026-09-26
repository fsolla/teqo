import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * C229 — semantic index of the speech acervo (`speechEmbedding`).
 *
 * Hand-reduced from the generated diff: the two 2026-09-24 snapshots
 * (`add_content_piece_link_failure_reason`, `add_content_piece_people`) lost
 * the objects of the C215/C219 migrations, so the generator tried to recreate
 * `internet_speech_media`, the recording facet tables and the speech origin
 * columns — all of which already exist wherever the chain applied. The snapshot
 * written next to this file is the current full config state, so future
 * migrations diff from a healed baseline; this SQL stays scoped to the new
 * table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_speech_embedding_kind" AS ENUM('speech', 'segment', 'window');
    CREATE TABLE "speech_embedding" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"speech_id" integer NOT NULL,
    	"kind" "enum_speech_embedding_kind" NOT NULL,
    	"order" numeric,
    	"start_seconds" numeric,
    	"model" varchar NOT NULL,
    	"dimensions" numeric NOT NULL,
    	"content_hash" varchar NOT NULL,
    	"vector" jsonb NOT NULL,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speech_embedding_id" integer;
    ALTER TABLE "speech_embedding" ADD CONSTRAINT "speech_embedding_speech_id_speech_id_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speech"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "speech_embedding_speech_idx" ON "speech_embedding" USING btree ("speech_id");
    CREATE INDEX "speech_embedding_kind_idx" ON "speech_embedding" USING btree ("kind");
    CREATE INDEX "speech_embedding_updated_at_idx" ON "speech_embedding" USING btree ("updated_at");
    CREATE INDEX "speech_embedding_created_at_idx" ON "speech_embedding" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speech_embedding_fk" FOREIGN KEY ("speech_embedding_id") REFERENCES "public"."speech_embedding"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_speech_embedding_id_idx" ON "payload_locked_documents_rels" USING btree ("speech_embedding_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "speech_embedding" DISABLE ROW LEVEL SECURITY;
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_speech_embedding_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_speech_embedding_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "speech_embedding_id";
    DROP TABLE IF EXISTS "speech_embedding" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_speech_embedding_kind";`)
}
