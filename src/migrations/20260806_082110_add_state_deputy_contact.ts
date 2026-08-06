import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      has_legacy_name boolean;
      has_long_name boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'name'
      ) INTO has_legacy_name;

      IF has_legacy_name THEN
        EXECUTE $check$
          SELECT EXISTS (
            SELECT 1
            FROM "state_deputy"
            WHERE char_length("name") > 120
          )
        $check$ INTO has_long_name;

        IF has_long_name THEN
          RAISE EXCEPTION 'Cannot migrate StateDeputy: a legacy name exceeds Contact''s 120-character limit';
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'contact_id'
      ) THEN
        ALTER TABLE "state_deputy" ADD COLUMN "contact_id" integer;
      END IF;
    END $$;

    DO $$
    DECLARE
      state_deputy_row RECORD;
      new_contact_id integer;
      created_count integer := 0;
      has_legacy_name boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'name'
      ) INTO has_legacy_name;

      IF has_legacy_name THEN
        FOR state_deputy_row IN
          SELECT "id", "name"
          FROM "state_deputy"
          WHERE "contact_id" IS NULL
          ORDER BY "id"
        LOOP
          INSERT INTO "contact" ("name", "state")
          VALUES (state_deputy_row."name", 'BA')
          RETURNING "id" INTO new_contact_id;

          UPDATE "state_deputy"
          SET "contact_id" = new_contact_id
          WHERE "id" = state_deputy_row."id";

          created_count := created_count + 1;
        END LOOP;
      END IF;

      RAISE NOTICE 'StateDeputy Contact backfill created % contacts.', created_count;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "state_deputy" WHERE "contact_id" IS NULL) THEN
        RAISE EXCEPTION 'StateDeputy Contact backfill left rows without contact_id';
      END IF;
    END $$;

    DO $$
    DECLARE
      names_mismatch boolean;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'name'
      ) THEN
        EXECUTE $check$
          SELECT EXISTS (
            SELECT 1
            FROM "state_deputy" AS state_deputy
            JOIN "contact" AS contact ON contact."id" = state_deputy."contact_id"
            WHERE contact."name" IS DISTINCT FROM state_deputy."name"
          )
        $check$ INTO names_mismatch;

        IF names_mismatch THEN
          RAISE EXCEPTION 'StateDeputy Contact backfill changed a legacy name';
        END IF;
      END IF;
    END $$;

    ALTER TABLE "state_deputy" ALTER COLUMN "contact_id" SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'state_deputy_contact_id_contact_id_fk'
      ) THEN
        ALTER TABLE "state_deputy"
          ADD CONSTRAINT "state_deputy_contact_id_contact_id_fk"
          FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id")
          ON DELETE restrict ON UPDATE no action;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "state_deputy_contact_idx"
      ON "state_deputy" USING btree ("contact_id");
    DROP INDEX IF EXISTS "state_deputy_name_idx";
    ALTER TABLE "state_deputy" DROP COLUMN IF EXISTS "name";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'contact_id'
      ) AND EXISTS (
        SELECT 1
        FROM "state_deputy" AS state_deputy
        JOIN "contact" AS contact ON contact."id" = state_deputy."contact_id"
        GROUP BY contact."name"
        HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION 'Cannot roll back StateDeputy Contact migration: Contact names are not unique';
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'state_deputy'
          AND column_name = 'contact_id'
      ) THEN
        ALTER TABLE "state_deputy" ADD COLUMN IF NOT EXISTS "name" varchar;

        UPDATE "state_deputy" AS state_deputy
        SET "name" = contact."name"
        FROM "contact" AS contact
        WHERE contact."id" = state_deputy."contact_id";

        IF EXISTS (SELECT 1 FROM "state_deputy" WHERE "name" IS NULL) THEN
          RAISE EXCEPTION 'Cannot roll back StateDeputy Contact migration: a name could not be restored';
        END IF;

        ALTER TABLE "state_deputy" ALTER COLUMN "name" SET NOT NULL;
        DROP INDEX IF EXISTS "state_deputy_contact_idx";
        ALTER TABLE "state_deputy"
          DROP CONSTRAINT IF EXISTS "state_deputy_contact_id_contact_id_fk";
        ALTER TABLE "state_deputy" DROP COLUMN "contact_id";
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "state_deputy_name_idx"
      ON "state_deputy" USING btree ("name");`)
}
