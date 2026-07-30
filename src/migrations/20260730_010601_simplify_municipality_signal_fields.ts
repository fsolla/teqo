import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "municipality_update" DROP COLUMN "signal_source";
  ALTER TABLE "municipality_update" DROP COLUMN "triangulated";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "municipality_update" ADD COLUMN "signal_source" varchar;
  ALTER TABLE "municipality_update" ADD COLUMN "triangulated" boolean DEFAULT false;`)
}
