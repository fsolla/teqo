/**
 * C14 — Remodel activity for the agenda (calendar) paradigm.
 *
 * Schema changes:
 * - `kind` (enum select) → `tags` (text[] — free-form, hasMany text)
 * - `origin` (enum select) → dropped
 * - `deadline` (timestamp) → dropped
 * - `status` enum: remove `rascunho`/`planejado`, keep `confirmado`/`realizado`/`cancelado`
 *
 * Data migration:
 * - `kind` values are mapped to human-readable labels as tags (comício → Comício, etc.)
 * - `rascunho` → `cancelado` (drafts had no date, honest destination)
 * - `planejado` → `confirmado` (planned activities had dates, they stay as commitments)
 * - Default status becomes `confirmado`
 */
import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Add tags column (text[])
    ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "tags" text[];

    -- 2. Migrate kind → tags (map enum values to human-readable labels)
    UPDATE "activity"
    SET "tags" = ARRAY[
      CASE "kind"
        WHEN 'caminhada' THEN 'Caminhada'
        WHEN 'comicio' THEN 'Comício'
        WHEN 'carreata' THEN 'Carreata'
        WHEN 'panfletagem' THEN 'Panfletagem'
        WHEN 'porta_a_porta' THEN 'Porta a porta'
        WHEN 'reuniao_apoio' THEN 'Reunião de apoio'
        WHEN 'lancamento' THEN 'Lançamento'
        WHEN 'convencao' THEN 'Convenção'
        WHEN 'ato' THEN 'Ato'
        WHEN 'entrevista' THEN 'Entrevista'
        WHEN 'producao_conteudo' THEN 'Produção de conteúdo'
        WHEN 'digital' THEN 'Digital'
        WHEN 'outro' THEN 'Outro'
        ELSE 'Outro'
      END
    ]
    WHERE "tags" IS NULL;

    -- 3. Remap statuses: rascunho → cancelado, planejado → confirmado
    UPDATE "activity" SET "status" = 'cancelado' WHERE "status" = 'rascunho';
    UPDATE "activity" SET "status" = 'confirmado' WHERE "status" = 'planejado';

    -- 4. Drop the old default (before changing enum type)
    ALTER TABLE "activity" ALTER COLUMN "status" DROP DEFAULT;

    -- 5. Drop old columns
    ALTER TABLE "activity" DROP COLUMN IF EXISTS "kind";
    ALTER TABLE "activity" DROP COLUMN IF EXISTS "origin";
    ALTER TABLE "activity" DROP COLUMN IF EXISTS "deadline";

    -- 6. Drop old indexes on kind
    DROP INDEX IF EXISTS "activity_kind_idx";

    -- 7. Add tags index (GIN for array containment queries)
    CREATE INDEX IF NOT EXISTS "activity_tags_idx" ON "activity" USING gin ("tags");

    -- 8. Drop old enum types
    DROP TYPE IF EXISTS "public"."enum_activity_kind";
    DROP TYPE IF EXISTS "public"."enum_activity_origin";

    -- 9. Recreate status enum without rascunho/planejado
    -- Drop partial index that references the old enum type
    DROP INDEX IF EXISTS "activity_upcoming_start_at_idx";

    -- Convert column to text first to detach from old enum
    ALTER TABLE "activity"
      ALTER COLUMN "status" TYPE text
      USING "status"::text;

    -- Drop the old enum type
    DROP TYPE "public"."enum_activity_status";

    -- Create the new enum
    CREATE TYPE "public"."enum_activity_status" AS ENUM ('confirmado', 'realizado', 'cancelado');

    -- Convert column back to the new enum type
    ALTER TABLE "activity"
      ALTER COLUMN "status" TYPE "public"."enum_activity_status"
      USING "status"::text::"public"."enum_activity_status";

    -- Set the new default
    ALTER TABLE "activity" ALTER COLUMN "status" SET DEFAULT 'confirmado';

    -- Recreate the partial index with the new enum type
    CREATE INDEX IF NOT EXISTS "activity_upcoming_start_at_idx" ON "activity"
      USING btree ("start_at")
      WHERE "status" = ANY (ARRAY['confirmado']::"public"."enum_activity_status"[]);

    -- Payload text search table (was action_plan_texts, never renamed in the
    -- C13 rename migration). Payload 3.82.0 expects activity_texts.
    CREATE TABLE IF NOT EXISTS "activity_texts" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "text" varchar
    );
    CREATE INDEX IF NOT EXISTS "activity_texts_order_parent" ON "activity_texts" USING btree ("order", "parent_id");
    ALTER TABLE "activity_texts" ADD CONSTRAINT "activity_texts_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "activity"("id") ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The down migration restores the schema but cannot recover dropped data.
  // origin/deadline values are lost; kind is restored from tags[0] reverse-mapped.
  await db.execute(sql`
    -- Restore old enum types
    CREATE TYPE "public"."enum_activity_kind" AS ENUM ('caminhada', 'comicio', 'carreata', 'panfletagem', 'porta_a_porta', 'reuniao_apoio', 'lancamento', 'convencao', 'ato', 'entrevista', 'producao_conteudo', 'digital', 'outro');
    CREATE TYPE "public"."enum_activity_origin" AS ENUM ('dado', 'pedido_broker', 'obrigacao_politica');

    -- Replace status enum with the old one
    ALTER TYPE "public"."enum_activity_status" RENAME TO "enum_activity_status_new";
    CREATE TYPE "public"."enum_activity_status" AS ENUM ('rascunho', 'planejado', 'confirmado', 'realizado', 'cancelado');
    ALTER TABLE "activity"
      ALTER COLUMN "status" TYPE "public"."enum_activity_status"
      USING "status"::text::"public"."enum_activity_status";
    DROP TYPE IF EXISTS "public"."enum_activity_status_new";

    -- Restore status default
    ALTER TABLE "activity" ALTER COLUMN "status" SET DEFAULT 'rascunho';

    -- Add columns back
    ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "kind" "public"."enum_activity_kind";
    ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "origin" "public"."enum_activity_origin" DEFAULT 'dado';
    ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "deadline" timestamp(3) with time zone;

    -- Reverse-map tags[0] → kind (best effort)
    UPDATE "activity"
    SET "kind" = CASE "tags"[1]
      WHEN 'Caminhada' THEN 'caminhada'
      WHEN 'Comício' THEN 'comicio'
      WHEN 'Carreata' THEN 'carreata'
      WHEN 'Panfletagem' THEN 'panfletagem'
      WHEN 'Porta a porta' THEN 'porta_a_porta'
      WHEN 'Reunião de apoio' THEN 'reuniao_apoio'
      WHEN 'Lançamento' THEN 'lancamento'
      WHEN 'Convenção' THEN 'convencao'
      WHEN 'Ato' THEN 'ato'
      WHEN 'Entrevista' THEN 'entrevista'
      WHEN 'Produção de conteúdo' THEN 'producao_conteudo'
      WHEN 'Digital' THEN 'digital'
      ELSE 'outro'
    END
    WHERE "tags" IS NOT NULL AND array_length("tags", 1) > 0;

    ALTER TABLE "activity" ALTER COLUMN "kind" SET NOT NULL;

    -- Restore kind index
    CREATE INDEX IF NOT EXISTS "activity_kind_idx" ON "activity" USING btree ("kind");

    -- Drop tags column and index
    DROP INDEX IF EXISTS "activity_tags_idx";
    ALTER TABLE "activity" DROP COLUMN IF EXISTS "tags";

    -- Drop text search table
    DROP TABLE IF EXISTS "activity_texts";
  `)
}
