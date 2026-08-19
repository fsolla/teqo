import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_campaign_user_visibility" AS ENUM('carteira', 'tudo');
  CREATE TYPE "public"."enum_campaign_user_editing" AS ENUM('carteira', 'tudo', 'somente_leitura');
  ALTER TABLE "campaign_user" ADD COLUMN "visibility" "enum_campaign_user_visibility" DEFAULT 'carteira';
  ALTER TABLE "campaign_user" ADD COLUMN "editing" "enum_campaign_user_editing" DEFAULT 'carteira';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "campaign_user" DROP COLUMN "visibility";
  ALTER TABLE "campaign_user" DROP COLUMN "editing";
  DROP TYPE "public"."enum_campaign_user_visibility";
  DROP TYPE "public"."enum_campaign_user_editing";`)
}
