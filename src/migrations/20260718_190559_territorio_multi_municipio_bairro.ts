import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'electoral_nucleus_texts'
      ) THEN
        CREATE TABLE "electoral_nucleus_texts" (
          "id" serial PRIMARY KEY NOT NULL,
          "order" integer NOT NULL,
          "parent_id" integer NOT NULL,
          "path" varchar NOT NULL,
          "text" varchar
        );

        ALTER TABLE "electoral_nucleus_texts"
          ADD CONSTRAINT "electoral_nucleus_texts_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."electoral_nucleus"("id")
          ON DELETE cascade ON UPDATE no action;

        CREATE INDEX "electoral_nucleus_texts_order_parent"
          ON "electoral_nucleus_texts" USING btree ("order", "parent_id");
        CREATE INDEX "electoral_nucleus_texts_parent_idx"
          ON "electoral_nucleus_texts" USING btree ("parent_id");
        CREATE INDEX "electoral_nucleus_texts_path_idx"
          ON "electoral_nucleus_texts" USING btree ("path");
        CREATE INDEX "electoral_nucleus_texts_text_idx"
          ON "electoral_nucleus_texts" USING btree ("text");
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'electoral_nucleus'
          AND column_name = 'region'
      ) THEN
        INSERT INTO "electoral_nucleus_texts" ("order", "parent_id", "path", "text")
        SELECT 1, "id", 'regions', "region"
        FROM "electoral_nucleus"
        WHERE "region" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "electoral_nucleus_texts" existing
            WHERE existing."parent_id" = "electoral_nucleus"."id"
              AND existing."path" = 'regions'
          );

        INSERT INTO "electoral_nucleus_texts" ("order", "parent_id", "path", "text")
        SELECT 1, "id", 'cities', "city"
        FROM "electoral_nucleus"
        WHERE "city" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "electoral_nucleus_texts" existing
            WHERE existing."parent_id" = "electoral_nucleus"."id"
              AND existing."path" = 'cities'
          );

        INSERT INTO "electoral_nucleus_texts" ("order", "parent_id", "path", "text")
        SELECT 1, "id", 'neighborhoods', "neighborhood"
        FROM "electoral_nucleus"
        WHERE "neighborhood" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "electoral_nucleus_texts" existing
            WHERE existing."parent_id" = "electoral_nucleus"."id"
              AND existing."path" = 'neighborhoods'
          );

        DROP INDEX IF EXISTS "electoral_nucleus_region_idx";
        DROP INDEX IF EXISTS "electoral_nucleus_city_idx";
        ALTER TABLE "electoral_nucleus" DROP COLUMN "region";
        ALTER TABLE "electoral_nucleus" DROP COLUMN "city";
        ALTER TABLE "electoral_nucleus" DROP COLUMN "neighborhood";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'electoral_nucleus_texts'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM "electoral_nucleus_texts"
          GROUP BY "parent_id", "path"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot down-migrate territorio_multi_municipio_bairro: one or more nuclei have multiple regions, cities, or neighborhoods.';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'electoral_nucleus'
            AND column_name = 'region'
        ) THEN
          ALTER TABLE "electoral_nucleus" ADD COLUMN "region" varchar;
          ALTER TABLE "electoral_nucleus" ADD COLUMN "city" varchar;
          ALTER TABLE "electoral_nucleus" ADD COLUMN "neighborhood" varchar;
        END IF;

        UPDATE "electoral_nucleus" nucleus
        SET "region" = texts."text"
        FROM "electoral_nucleus_texts" texts
        WHERE texts."parent_id" = nucleus."id"
          AND texts."path" = 'regions'
          AND texts."order" = 1;

        UPDATE "electoral_nucleus" nucleus
        SET "city" = texts."text"
        FROM "electoral_nucleus_texts" texts
        WHERE texts."parent_id" = nucleus."id"
          AND texts."path" = 'cities'
          AND texts."order" = 1;

        UPDATE "electoral_nucleus" nucleus
        SET "neighborhood" = texts."text"
        FROM "electoral_nucleus_texts" texts
        WHERE texts."parent_id" = nucleus."id"
          AND texts."path" = 'neighborhoods'
          AND texts."order" = 1;

        DROP TABLE "electoral_nucleus_texts" CASCADE;
        CREATE INDEX IF NOT EXISTS "electoral_nucleus_region_idx"
          ON "electoral_nucleus" USING btree ("region");
        CREATE INDEX IF NOT EXISTS "electoral_nucleus_city_idx"
          ON "electoral_nucleus" USING btree ("city");
      END IF;
    END $$;
  `)
}
