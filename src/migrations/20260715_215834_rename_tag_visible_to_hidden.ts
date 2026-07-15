import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Inverts the tag visibility flag: the old `visible` (default true, "shown")
 * checkbox becomes `hidden` (default false, "Esconder"). This is DATA-PRESERVING
 * on purpose — a naive generated migration would drop `visible` and add `hidden`,
 * discarding which tags were toggled. Instead we add `hidden`, backfill it as the
 * logical inverse of `visible` (`hidden = NOT visible`), then drop `visible`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tag" ADD COLUMN "hidden" boolean DEFAULT false;
    UPDATE "tag" SET "hidden" = NOT COALESCE("visible", true);
    ALTER TABLE "tag" DROP COLUMN "visible";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tag" ADD COLUMN "visible" boolean DEFAULT true;
    UPDATE "tag" SET "visible" = NOT COALESCE("hidden", false);
    ALTER TABLE "tag" DROP COLUMN "hidden";
  `)
}
