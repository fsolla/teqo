import 'server-only'

import type { Payload } from 'payload'

import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { ConsentDescriptor } from '@/utilities/campaignConsent'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { getPostgresTransactionDatabase } from '@/utilities/postgresTransactionLocks'
import { relationshipId } from '@/utilities/relationship'

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
  insert: (table: unknown) => {
    values: (rows: Record<string, unknown>[]) => {
      onConflictDoNothing: () => Promise<DrizzleInsertResult>
    }
  }
}

type DrizzleTables = Record<string, Record<string, unknown>>

type PayloadDb = {
  drizzle: unknown
  tables: DrizzleTables
}

const CONTACT_TABLE = 'contact'
const SUPPORTER_TABLE = 'supporter'

/** ~16 columns × 500 ≈ 8000 bind params — well under PG 65535. */
const INSERT_CHUNK_SIZE = 500

const chunk = <T>(rows: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

const getTables = (payload: Payload): DrizzleTables =>
  (payload.db as unknown as PayloadDb).tables

const requireTable = (tables: DrizzleTables, name: string) => {
  const table = tables[name]
  if (!table) throw new Error(`Tabela drizzle ausente: ${name}. Rode as migrations.`)
  return table
}

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
    nucleus: null,
    voteIntention: row.intencao ?? null,
    consent: args.registrationConsent.id,
    consentContentHash: args.registrationConsent.contentHash,
    consentedAt: args.now,
    voteIntentionConsent: row.intencao ? args.voteIntentionConsent.id : null,
    voteIntentionConsentContentHash: row.intencao
      ? args.voteIntentionConsent.contentHash
      : null,
    voteIntentionConsentedAt: row.intencao ? args.now : null,
    source: 'import_csv',
    consentNote: args.consentNote,
    notes: null,
    createdBy: args.actorID,
    createdAt: args.now,
    updatedAt: args.now,
  }))

/**
 * Bulk-insert contacts and nucleus-less supporters for a CSV import inside the
 * caller's Payload transaction. Phone advisory locks MUST already be held for
 * every phone in `rows` (the caller acquires them before invoking this helper).
 *
 * Contacts are inserted via drizzle (bypassing the Contact phone-invariant hook,
 * which is safe because the locks guarantee uniqueness within the txn). The
 * supporter insert uses `ON CONFLICT DO NOTHING` on the unique
 * `(contact_id, nucleus_id)` index as a last-resort guard against races.
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

  const tables = getTables(payload)
  const contactTable = requireTable(tables, CONTACT_TABLE)
  const supporterTable = requireTable(tables, SUPPORTER_TABLE)
  const database = await getPostgresTransactionDatabase(payload, req)
  const tx = database as unknown as DrizzleTx
  const now = new Date().toISOString()

  const phones = [...new Set(rows.map((row) => row.telefone))]

  const existingContacts = await payload.find({
    collection: 'contact',
    where: { phone: { in: phones } },
    depth: 0,
    limit: phones.length,
    pagination: false,
    select: { phone: true },
    overrideAccess: true,
    req,
  })
  const contactIdByPhone = new Map(
    existingContacts.docs.map((doc) => [doc.phone, doc.id] as const),
  )

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
      await tx.insert(contactTable).values(buildContactRows(batch, now))
    }

    const newPhones = [...newContactByPhone.keys()]
    const createdContacts = await payload.find({
      collection: 'contact',
      where: { phone: { in: newPhones } },
      depth: 0,
      limit: newPhones.length,
      pagination: false,
      select: { phone: true },
      overrideAccess: true,
      req,
    })
    for (const doc of createdContacts.docs) {
      contactIdByPhone.set(doc.phone, doc.id)
    }
  }

  const contactIDs = [...new Set(contactIdByPhone.values())]
  const existingSupporters = await payload.find({
    collection: 'supporter',
    where: {
      and: [{ contact: { in: contactIDs } }, { nucleus: { exists: false } }],
    },
    depth: 0,
    limit: contactIDs.length,
    pagination: false,
    select: { contact: true },
    overrideAccess: true,
    req,
  })
  const supporterContactIDs = new Set(
    existingSupporters.docs
      .map((doc) => relationshipId(doc.contact))
      .filter((id): id is number => id !== null),
  )

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
