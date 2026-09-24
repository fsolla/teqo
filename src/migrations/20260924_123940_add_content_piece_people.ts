import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "content_piece_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "content_piece_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"leadership_id" integer
  );
  
  ALTER TABLE "content_piece_texts" ADD CONSTRAINT "content_piece_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_piece"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_piece_rels" ADD CONSTRAINT "content_piece_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_piece"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_piece_rels" ADD CONSTRAINT "content_piece_rels_leadership_fk" FOREIGN KEY ("leadership_id") REFERENCES "public"."leadership"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "content_piece_texts_order_parent" ON "content_piece_texts" USING btree ("order","parent_id");
  CREATE INDEX "content_piece_rels_order_idx" ON "content_piece_rels" USING btree ("order");
  CREATE INDEX "content_piece_rels_parent_idx" ON "content_piece_rels" USING btree ("parent_id");
  CREATE INDEX "content_piece_rels_path_idx" ON "content_piece_rels" USING btree ("path");
  CREATE INDEX "content_piece_rels_leadership_id_idx" ON "content_piece_rels" USING btree ("leadership_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "content_piece_texts" CASCADE;
  DROP TABLE "content_piece_rels" CASCADE;`)
}
