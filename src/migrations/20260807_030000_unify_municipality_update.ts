import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * C87 — Atualização unificada (texto + polaridade + urgente).
 *
 * Reescreve o modelo de MunicipalityUpdate: elimina kind (semanal/urgente/nota/sinal)
 * e signalType, substituindo por polarity (boa/neutra/ruim), urgent (boolean) e
 * adversarySignal (boolean, para E11).
 *
 * Backfill:
 * - polarity = 'neutra' (padrão — não há mapeamento semântico fino de old kinds)
 *- urgent = TRUE onde kind = 'urgente'
 * - adversary_signal = TRUE onde kind = 'sinal' E signal_type IN (invasao, visita_adversario, proposta_broker)
 * - body: para kind = 'semanal', concatena worked || ' | ' || failed || ' | ' || needs;
 *   para outros kinds, mantém o body existente
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Create the new polarity enum type
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_municipality_update_polarity') THEN
        CREATE TYPE "enum_municipality_update_polarity" AS ENUM ('boa', 'neutra', 'ruim');
      END IF;
    END $$;

    -- 2. Add new columns
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "polarity" "enum_municipality_update_polarity";
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "urgent" boolean DEFAULT false;
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "adversary_signal" boolean DEFAULT false;

    -- 3. Backfill polarity (all default to neutra)
    UPDATE "municipality_update" SET "polarity" = 'neutra' WHERE "polarity" IS NULL;

    -- 3b. Set NOT NULL now that all rows have a value
    ALTER TABLE "municipality_update" ALTER COLUMN "polarity" SET NOT NULL;

    -- 4. Backfill urgent from kind
    UPDATE "municipality_update" SET "urgent" = true WHERE "kind" = 'urgente';

    -- 5. Backfill adversary_signal from kind + signal_type
    UPDATE "municipality_update"
      SET "adversary_signal" = true
      WHERE "kind" = 'sinal'
        AND "signal_type" IN ('invasao', 'visita_adversario', 'proposta_broker');

    -- 6. Backfill body: for semanal, concatenate worked|failed|needs
    UPDATE "municipality_update"
      SET "body" = TRIM(COALESCE(NULLIF(CONCAT_WS(' | ', "worked", "failed", "needs"), ' | '), ''))
      WHERE "kind" = 'semanal'
        AND (COALESCE("worked", '') || COALESCE("failed", '') || COALESCE("needs", '')) != '';

    -- 7. Drop old indexes
    DROP INDEX IF EXISTS "municipality_update_kind_idx";

    -- 8. Drop old columns
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "kind";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "signal_type";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "worked";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "failed";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "needs";

    -- 9. Drop old enum types (only if no other table uses them)
    DROP TYPE IF EXISTS "enum_municipality_update_kind";
    DROP TYPE IF EXISTS "enum_municipality_update_signal_type";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Recreate old enum types
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_municipality_update_kind') THEN
        CREATE TYPE "enum_municipality_update_kind" AS ENUM ('semanal', 'urgente', 'nota', 'sinal');
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_municipality_update_signal_type') THEN
        CREATE TYPE "enum_municipality_update_signal_type" AS ENUM ('invasao', 'esfriamento', 'visita_adversario', 'proposta_broker', 'outro');
      END IF;
    END $$;

    -- Recreate old columns (data lost on rollback — acceptable for dev)
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "kind" "enum_municipality_update_kind" DEFAULT 'semanal' NOT NULL;
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "signal_type" "enum_municipality_update_signal_type";
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "worked" varchar;
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "failed" varchar;
    ALTER TABLE "municipality_update" ADD COLUMN IF NOT EXISTS "needs" varchar;

    -- Map back urgent → kind
    UPDATE "municipality_update" SET "kind" = 'urgente' WHERE "urgent" = true;
    UPDATE "municipality_update" SET "kind" = CASE WHEN "kind" IS NULL THEN 'nota' ELSE "kind" END WHERE "kind" IS NULL;

    -- Map back adversary_signal → sinal + signal_type
    UPDATE "municipality_update"
      SET "kind" = 'sinal', "signal_type" = 'invasao'
      WHERE "adversary_signal" = true AND "kind" != 'sinal';

    -- Drop new columns
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "polarity";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "urgent";
    ALTER TABLE "municipality_update" DROP COLUMN IF EXISTS "adversary_signal";

    DROP TYPE IF EXISTS "enum_municipality_update_polarity";
  `)
}
