import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity" ADD COLUMN "public_event" boolean DEFAULT false;
  CREATE INDEX "activity_public_event_idx" ON "activity" USING btree ("public_event");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "activity_public_event_idx";
  ALTER TABLE "activity" DROP COLUMN "public_event";`)
}
