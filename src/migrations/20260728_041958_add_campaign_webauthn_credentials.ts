import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `campaignWebAuthnCredential` collection (roadmap B40): one row per
 * passkey enrolled on one device, holding only the credential's public half.
 *
 * Hand-edited from the Payload-generated diff: the statements are guarded
 * (`IF NOT EXISTS` / `pg_constraint` probe) and `down()` drops the
 * `payload_locked_documents_rels` bits BEFORE the table, because
 * `DROP TABLE ... CASCADE` already removes the constraint the generated order
 * then tried to drop by name.
 *
 * The FK keeps Payload's default `ON DELETE set null` even though `user_id` is
 * NOT NULL — which alone would make an account undeletable once it enrolled a
 * passkey. Deleting the credentials is instead a `beforeDelete` hook on
 * `campaignUser`: the generator derives FK actions from the collection config,
 * so a hand-written `cascade` here is drift that every future `migrate:create`
 * would try to revert (verified with a probe migration).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "campaign_web_authn_credential" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "credential_id" varchar NOT NULL,
      "public_key" varchar NOT NULL,
      "counter" numeric DEFAULT 0 NOT NULL,
      "transports" jsonb,
      "device_label" varchar NOT NULL,
      "last_used_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "campaign_web_authn_credential_id" integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'campaign_web_authn_credential_user_id_campaign_user_id_fk'
      ) THEN
        ALTER TABLE "campaign_web_authn_credential"
          ADD CONSTRAINT "campaign_web_authn_credential_user_id_campaign_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."campaign_user"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "campaign_web_authn_credential_user_idx"
      ON "campaign_web_authn_credential" USING btree ("user_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "campaign_web_authn_credential_credential_id_idx"
      ON "campaign_web_authn_credential" USING btree ("credential_id");
    CREATE INDEX IF NOT EXISTS "campaign_web_authn_credential_updated_at_idx"
      ON "campaign_web_authn_credential" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "campaign_web_authn_credential_created_at_idx"
      ON "campaign_web_authn_credential" USING btree ("created_at");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payload_locked_documents_rels_campaign_web_authn_credenti_fk'
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_campaign_web_authn_credenti_fk"
          FOREIGN KEY ("campaign_web_authn_credential_id")
          REFERENCES "public"."campaign_web_authn_credential"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_campaign_web_authn_credent_idx"
      ON "payload_locked_documents_rels" USING btree ("campaign_web_authn_credential_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_web_authn_credenti_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_campaign_web_authn_credent_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "campaign_web_authn_credential_id";

    DROP TABLE IF EXISTS "campaign_web_authn_credential" CASCADE;
  `)
}
