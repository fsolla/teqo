import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reel" ADD COLUMN "source_hash" varchar;
  CREATE UNIQUE INDEX "reel_source_hash_idx" ON "reel" USING btree ("source_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "reel_source_hash_idx";
  ALTER TABLE "reel" DROP COLUMN "source_hash";`)
}
