import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Pass 2 D3 — retire the last hardcoded consent document id.
 *
 * The public WhatsApp subscription flow (`submitWhatsapp.ts`) used to write
 * `consent: 2`. This tags that SAME live document with the stable key
 * `whatsapp-inscricao`, so the code can resolve it fail-closed by key like
 * every campaign consent. Idempotent and guarded:
 *
 * - no-op when a document already carries the key (target state);
 * - no-op when id 2 does not exist or already carries a different key —
 *   the flow then fails closed until an admin creates the keyed document
 *   (deliberately NOT inventing consent text here: the wording is
 *   counsel-owned, same policy as the Onda 0 keys).
 *
 * The live document's `key` is the EMPTY STRING (Payload text default), so
 * the guard treats '' and NULL alike.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "consent"
    SET "key" = 'whatsapp-inscricao', "updated_at" = now()
    WHERE "id" = 2
      AND ("key" IS NULL OR "key" = '')
      AND NOT EXISTS (
        SELECT 1 FROM "consent" WHERE "key" = 'whatsapp-inscricao'
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "consent"
    SET "key" = NULL, "updated_at" = now()
    WHERE "id" = 2 AND "key" = 'whatsapp-inscricao';
  `)
}
