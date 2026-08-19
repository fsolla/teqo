import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_subscription_campaign_level" AS ENUM('time', 'esporadico');
  ALTER TABLE "contact" ALTER COLUMN "state" DROP NOT NULL;
  ALTER TABLE "subscription" ADD COLUMN "campaign_level" "enum_subscription_campaign_level";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contact" ALTER COLUMN "state" SET NOT NULL;
  ALTER TABLE "subscription" DROP COLUMN "campaign_level";
  DROP TYPE "public"."enum_subscription_campaign_level";`)
}
