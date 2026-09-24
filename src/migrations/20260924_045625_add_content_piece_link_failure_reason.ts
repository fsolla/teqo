import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_content_piece_link_failure_reason" AS ENUM('nao-encontrado', 'carrossel', 'indisponivel', 'sem-credencial');
  ALTER TABLE "content_piece" ADD COLUMN "link_failure_reason" "enum_content_piece_link_failure_reason";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "content_piece" DROP COLUMN "link_failure_reason";
  DROP TYPE "public"."enum_content_piece_link_failure_reason";`)
}
