import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_post_type" AS ENUM('noticia', 'campanha', 'artigo', 'evento');
  CREATE TYPE "public"."enum_post_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__post_v_version_type" AS ENUM('noticia', 'campanha', 'artigo', 'evento');
  CREATE TYPE "public"."enum__post_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "post" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"type" "enum_post_type",
  	"category_id" integer,
  	"subtitle" varchar,
  	"cover_image_id" integer,
  	"published_date" timestamp(3) with time zone,
  	"body" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_post_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "post_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tag_id" integer
  );
  
  CREATE TABLE "_post_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_type" "enum__post_v_version_type",
  	"version_category_id" integer,
  	"version_subtitle" varchar,
  	"version_cover_image_id" integer,
  	"version_published_date" timestamp(3) with time zone,
  	"version_body" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__post_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_post_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tag_id" integer
  );
  
  CREATE TABLE "tag" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"visible" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "post_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tag_id" integer;
  ALTER TABLE "post" ADD CONSTRAINT "post_category_id_tag_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tag"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "post" ADD CONSTRAINT "post_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "post_rels" ADD CONSTRAINT "post_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "post_rels" ADD CONSTRAINT "post_rels_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_post_v" ADD CONSTRAINT "_post_v_parent_id_post_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."post"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_post_v" ADD CONSTRAINT "_post_v_version_category_id_tag_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."tag"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_post_v" ADD CONSTRAINT "_post_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_post_v_rels" ADD CONSTRAINT "_post_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_post_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_post_v_rels" ADD CONSTRAINT "_post_v_rels_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "post_slug_idx" ON "post" USING btree ("slug");
  CREATE INDEX "post_category_idx" ON "post" USING btree ("category_id");
  CREATE INDEX "post_cover_image_idx" ON "post" USING btree ("cover_image_id");
  CREATE INDEX "post_updated_at_idx" ON "post" USING btree ("updated_at");
  CREATE INDEX "post_created_at_idx" ON "post" USING btree ("created_at");
  CREATE INDEX "post__status_idx" ON "post" USING btree ("_status");
  CREATE INDEX "post_rels_order_idx" ON "post_rels" USING btree ("order");
  CREATE INDEX "post_rels_parent_idx" ON "post_rels" USING btree ("parent_id");
  CREATE INDEX "post_rels_path_idx" ON "post_rels" USING btree ("path");
  CREATE INDEX "post_rels_tag_id_idx" ON "post_rels" USING btree ("tag_id");
  CREATE INDEX "_post_v_parent_idx" ON "_post_v" USING btree ("parent_id");
  CREATE INDEX "_post_v_version_version_slug_idx" ON "_post_v" USING btree ("version_slug");
  CREATE INDEX "_post_v_version_version_category_idx" ON "_post_v" USING btree ("version_category_id");
  CREATE INDEX "_post_v_version_version_cover_image_idx" ON "_post_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_post_v_version_version_updated_at_idx" ON "_post_v" USING btree ("version_updated_at");
  CREATE INDEX "_post_v_version_version_created_at_idx" ON "_post_v" USING btree ("version_created_at");
  CREATE INDEX "_post_v_version_version__status_idx" ON "_post_v" USING btree ("version__status");
  CREATE INDEX "_post_v_created_at_idx" ON "_post_v" USING btree ("created_at");
  CREATE INDEX "_post_v_updated_at_idx" ON "_post_v" USING btree ("updated_at");
  CREATE INDEX "_post_v_latest_idx" ON "_post_v" USING btree ("latest");
  CREATE INDEX "_post_v_rels_order_idx" ON "_post_v_rels" USING btree ("order");
  CREATE INDEX "_post_v_rels_parent_idx" ON "_post_v_rels" USING btree ("parent_id");
  CREATE INDEX "_post_v_rels_path_idx" ON "_post_v_rels" USING btree ("path");
  CREATE INDEX "_post_v_rels_tag_id_idx" ON "_post_v_rels" USING btree ("tag_id");
  CREATE UNIQUE INDEX "tag_slug_idx" ON "tag" USING btree ("slug");
  CREATE INDEX "tag_updated_at_idx" ON "tag" USING btree ("updated_at");
  CREATE INDEX "tag_created_at_idx" ON "tag" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_post_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_post_id_idx" ON "payload_locked_documents_rels" USING btree ("post_id");
  CREATE INDEX "payload_locked_documents_rels_tag_id_idx" ON "payload_locked_documents_rels" USING btree ("tag_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "post" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "post_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_post_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_post_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tag" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "post" CASCADE;
  DROP TABLE "post_rels" CASCADE;
  DROP TABLE "_post_v" CASCADE;
  DROP TABLE "_post_v_rels" CASCADE;
  DROP TABLE "tag" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_post_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tag_fk";
  
  DROP INDEX "payload_locked_documents_rels_post_id_idx";
  DROP INDEX "payload_locked_documents_rels_tag_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "post_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tag_id";
  DROP TYPE "public"."enum_post_type";
  DROP TYPE "public"."enum_post_status";
  DROP TYPE "public"."enum__post_v_version_type";
  DROP TYPE "public"."enum__post_v_version_status";`)
}
