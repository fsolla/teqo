import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C200 — speaker grouping of the uploaded recordings: the anonymous cluster key
 * on each segment, the human labels on the recording (one row per identified
 * cluster) and the flag a reprocessing sets when a label could not be
 * re-associated. `recording_texts` is Payload's join table for the derived
 * `speakerNames` (`hasMany text`).
 *
 * The generated diff also carried `reel.source_hash` because the C199 snapshot
 * (20260919_003440) was taken before the sibling `20260919_002605` landed — the
 * column already exists in every environment, so that SQL was removed here by
 * hand. The snapshot JSON of THIS migration is current, so the phantom diff
 * does not come back.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "recording_speaker_labels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"speaker_key" varchar NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "recording_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "recording" ADD COLUMN "speaker_labels_dropped" boolean;
  ALTER TABLE "recording_segment" ADD COLUMN "speaker_key" varchar;
  ALTER TABLE "recording_speaker_labels" ADD CONSTRAINT "recording_speaker_labels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recording_texts" ADD CONSTRAINT "recording_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."recording"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "recording_speaker_labels_order_idx" ON "recording_speaker_labels" USING btree ("_order");
  CREATE INDEX "recording_speaker_labels_parent_id_idx" ON "recording_speaker_labels" USING btree ("_parent_id");
  CREATE INDEX "recording_texts_order_parent" ON "recording_texts" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recording_speaker_labels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "recording_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "recording_speaker_labels" CASCADE;
  DROP TABLE "recording_texts" CASCADE;
  ALTER TABLE "recording" DROP COLUMN "speaker_labels_dropped";
  ALTER TABLE "recording_segment" DROP COLUMN "speaker_key";`)
}
