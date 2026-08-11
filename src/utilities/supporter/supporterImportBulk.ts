import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { ConsentDescriptor } from '@/utilities/campaignConsent'
import {
  assertDrizzleColumns,
  chunk,
  drizzleResultRows,
  getDrizzleTables,
  INSERT_CHUNK_SIZE,
  requireTable,
} from '@/utilities/drizzleBulk'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { getPostgresTransactionDatabase } from '@/utilities/postgresTransactionLocks'
import { SUPPORTER_IMPORT_SHARED_PHONE_MESSAGE } from '@/utilities/supporter/supporterImport'

export type SupporterImportBulkRow = {
  telefone: string
  nome: string
  municipio?: string
  intencao?: SupporterVoteIntention
}

export type SupporterImportBulkResult = {
  created: number
  skipped: number
  errors: Array<{ telefone: string; message: string }>
}

type DrizzleInsertResult = { rowCount?: number | null }

type DrizzleTx = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
  insert: (table: unknown) => {
    values: (rows: Record<string, unknown>[]) => {
      onConflictDoNothing: () => Promise<DrizzleInsertResult>
      returning: () => Promise<Array<Record<string, unknown>>>
    }
  }
}

const CONTACT_TABLE = 'contact'
const SUPPORTER_TABLE = 'supporter'

/**
 * Columns the bulk supporter insert writes (drizzle JS-level names, which omit
 * the `Id` suffix Payload relationship fields get at the physical-column level).
 * Asserted against the live table scaffold on every import — see `assertDrizzleColumns`.
 */
const SUPPORTER_COLUMNS = [
  'contact',
  'municipality',
  'voteIntention',
  'consent',
  'consentContentHash',
  'consentedAt',
  'voteIntentionConsent',
  'voteIntentionConsentContentHash',
  'voteIntentionConsentedAt',
  'source',
  'consentNote',
  'notes',
  'createdBy',
  'createdAt',
  'updatedAt',
] as const

const buildContactRows = (
  rows: SupporterImportBulkRow[],
  now: string,
): Array<Record<string, unknown>> =>
  rows.map((row) => ({
    name: row.nome,
    phone: row.telefone,
    email: null,
    state: 'BA',
    city: row.municipio ?? null,
    postalCode: null,
    gender: null,
    createdAt: now,
    updatedAt: now,
  }))

const buildSupporterRows = (
  entries: Array<{
    row: SupporterImportBulkRow
    contactID: number
  }>,
  args: {
    actorID: number
    registrationConsent: ConsentDescriptor
    voteIntentionConsent: ConsentDescriptor
    consentNote: string
    now: string
  },
): Array<Record<string, unknown>> =>
  entries.map(({ row, contactID }) => ({
    // Drizzle column names for Payload relationship fields omit the `Id` suffix.
    contact: contactID,
    municipality: null,
    voteIntention: row.intencao ?? null,
    consent: args.registrationConsent.id,
    consentContentHash: args.registrationConsent.contentHash,
    consentedAt: args.now,
    voteIntentionConsent: row.intencao ? args.voteIntentionConsent.id : null,
    voteIntentionConsentContentHash: row.intencao ? args.voteIntentionConsent.contentHash : null,
    voteIntentionConsentedAt: row.intencao ? args.now : null,
    source: 'import_csv',
    consentNote: args.consentNote,
    notes: null,
    createdBy: args.actorID,
    createdAt: args.now,
    updatedAt: args.now,
  }))

const asPhoneKeyedRow = (row: Record<string, unknown>): { id: number; phone: string } | null => {
  const { id, phone } = row
  return typeof id === 'number' && typeof phone === 'string' ? { id, phone } : null
}

const asContactID = (row: Record<string, unknown>): number | null => {
  const value = row.contact_id
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/**
 * Bulk-insert contacts and municipality-less supporters for a CSV import inside the
 * caller's Payload transaction. Phone advisory locks MUST already be held for
 * every phone in `rows` (the caller acquires them before invoking this helper).
 *
 * Contacts are inserted via drizzle (bypassing the Contact collection hooks,
 * which is safe because the phone locks serialize this flow and the shared-
 * phone abort below proves each phone still resolves to at most one ficha).
 * The supporter insert uses `ON CONFLICT DO NOTHING` on the unique
 * `(contact_id, municipality_id)` index as a last-resort guard against races.
 *
 * All reads (existing contacts, existing supporters) and the ID recovery for
 * newly inserted contacts run as raw SQL / `.returning()` on the same drizzle
 * transaction session — no `payload.find` round trips through the Local API.
 */
export const bulkInsertSupporterImport = async (args: {
  payload: Payload
  req: PayloadTransactionRequest
  actorID: number
  rows: SupporterImportBulkRow[]
  registrationConsent: ConsentDescriptor
  voteIntentionConsent: ConsentDescriptor
  consentNote: string
}): Promise<SupporterImportBulkResult> => {
  const { payload, req, actorID, rows } = args
  if (rows.length === 0) {
    return { created: 0, skipped: 0, errors: [] }
  }

  const tables = getDrizzleTables(payload)
  const contactTable = requireTable(tables, CONTACT_TABLE)
  const supporterTable = requireTable(tables, SUPPORTER_TABLE)
  assertDrizzleColumns(supporterTable, SUPPORTER_TABLE, SUPPORTER_COLUMNS)

  const database = await getPostgresTransactionDatabase(payload, req)
  const tx = database as unknown as DrizzleTx
  const now = new Date().toISOString()

  const phones = [...new Set(rows.map((row) => row.telefone))]

  const contactIdByPhone = new Map<string, number>()
  for (const phoneBatch of chunk(phones, INSERT_CHUNK_SIZE)) {
    const existingContactRows = drizzleResultRows(
      await tx.execute(
        sql`SELECT "id", "phone" FROM "contact" WHERE "phone" IN (${sql.join(
          phoneBatch.map((phone) => sql`${phone}`),
          sql`, `,
        )})`,
      ),
    )
    for (const row of existingContactRows) {
      const parsed = asPhoneKeyedRow(row)
      if (!parsed) continue
      // C111 — the phone is not unique. The preview flags shared phones, but
      // the base can change between preview and confirm; with the phone
      // advisory locks held, a second ficha here is a real ambiguity, so the
      // import aborts fail-closed instead of silently picking a ficha.
      if (contactIdByPhone.has(parsed.phone)) {
        throw new Error(SUPPORTER_IMPORT_SHARED_PHONE_MESSAGE)
      }
      contactIdByPhone.set(parsed.phone, parsed.id)
    }
  }

  // New contacts to create, deduped by phone (preview already dedupes, but this
  // is defensive against a stale confirm payload).
  const newContactByPhone = new Map<string, SupporterImportBulkRow>()
  for (const row of rows) {
    if (contactIdByPhone.has(row.telefone)) continue
    if (newContactByPhone.has(row.telefone)) continue
    newContactByPhone.set(row.telefone, row)
  }

  if (newContactByPhone.size > 0) {
    const newRows = [...newContactByPhone.values()]
    for (const batch of chunk(newRows, INSERT_CHUNK_SIZE)) {
      const created = await tx.insert(contactTable).values(buildContactRows(batch, now)).returning()
      for (const row of created) {
        const inserted = asPhoneKeyedRow(row)
        if (inserted) contactIdByPhone.set(inserted.phone, inserted.id)
      }
    }
  }

  const contactIDs = [...new Set(contactIdByPhone.values())]
  const supporterContactIDs = new Set<number>()
  if (contactIDs.length > 0) {
    for (const idBatch of chunk(contactIDs, INSERT_CHUNK_SIZE)) {
      const existingSupporterRows = drizzleResultRows(
        await tx.execute(
          sql`SELECT "contact_id" FROM "supporter" WHERE "contact_id" IN (${sql.join(
            idBatch.map((id) => sql`${id}`),
            sql`, `,
          )}) AND "municipality_id" IS NULL`,
        ),
      )
      for (const row of existingSupporterRows) {
        const contactID = asContactID(row)
        if (contactID !== null) supporterContactIDs.add(contactID)
      }
    }
  }

  const candidateEntries: Array<{ row: SupporterImportBulkRow; contactID: number }> = []
  const errors: Array<{ telefone: string; message: string }> = []
  let skipped = 0

  for (const row of rows) {
    const contactID = contactIdByPhone.get(row.telefone)
    if (!contactID) {
      skipped += 1
      errors.push({ telefone: row.telefone, message: 'Contato não encontrado após upsert.' })
      continue
    }
    if (supporterContactIDs.has(contactID)) {
      skipped += 1
      continue
    }
    candidateEntries.push({ row, contactID })
    // Reserve against duplicate phones within the same payload.
    supporterContactIDs.add(contactID)
  }

  let created = 0
  for (const batch of chunk(candidateEntries, INSERT_CHUNK_SIZE)) {
    const result = await tx
      .insert(supporterTable)
      .values(
        buildSupporterRows(batch, {
          actorID,
          registrationConsent: args.registrationConsent,
          voteIntentionConsent: args.voteIntentionConsent,
          consentNote: args.consentNote,
          now,
        }),
      )
      .onConflictDoNothing()
    // rowCount reflects inserted rows only (conflicts are skipped). Fall back to 0
    // rather than batch.length so a null rowCount never silently over-counts.
    created += Number(result.rowCount ?? 0)
  }

  return { created, skipped, errors }
}
