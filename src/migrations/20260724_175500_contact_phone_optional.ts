import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Makes contact.phone nullable so name-only records can exist (e.g. leaderships
 * imported from the projection sheet, E4R fase 2). UI flows keep requiring the
 * phone via their zod schemas; only the collection/database constraint relaxes.
 * Idempotent: DROP NOT NULL is a no-op when the column is already nullable.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "contact" ALTER COLUMN "phone" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Restoring NOT NULL fails if phone-less rows exist — remove them first by hand.
  await db.execute(sql`
    ALTER TABLE "contact" ALTER COLUMN "phone" SET NOT NULL;
  `)
}
