import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity" ADD COLUMN "all_day" boolean DEFAULT false;
  CREATE INDEX "activity_all_day_idx" ON "activity" USING btree ("all_day");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "activity_all_day_idx";
  ALTER TABLE "activity" DROP COLUMN "all_day";`)
}
