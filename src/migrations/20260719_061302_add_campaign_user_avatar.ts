import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "campaign_user" ADD COLUMN IF NOT EXISTS "avatar_id" integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_user_avatar_id_media_id_fk'
      ) THEN
        ALTER TABLE "campaign_user"
          ADD CONSTRAINT "campaign_user_avatar_id_media_id_fk"
          FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "campaign_user_avatar_idx"
      ON "campaign_user" USING btree ("avatar_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "campaign_user" DROP CONSTRAINT IF EXISTS "campaign_user_avatar_id_media_id_fk";
    DROP INDEX IF EXISTS "campaign_user_avatar_idx";
    ALTER TABLE "campaign_user" DROP COLUMN IF EXISTS "avatar_id";
  `)
}
