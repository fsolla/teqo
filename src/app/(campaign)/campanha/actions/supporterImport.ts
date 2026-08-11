'use server'

import { parse } from 'csv-parse/sync'
import type { Payload } from 'payload'

import { normalizeBrazilianPhone } from '@/lib/phone'
import { relationshipId } from '@/lib/relationship'
import {
  resolveBahiaMunicipality,
  SUPPORTER_IMPORT_BATCH_EMPTY_MESSAGE,
  SUPPORTER_IMPORT_CSV_EMPTY_MESSAGE,
  SUPPORTER_IMPORT_CSV_UNREADABLE_MESSAGE,
  supporterImportConfirmSchema,
  supporterImportCsvTooManyRowsMessage,
  supporterImportCsvUnknownColumnsMessage,
  type SupporterVoteIntention,
} from '@/lib/schemas/supporter'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCoordinatorActor } from '@/utilities/campaignActionContext'
import {
  requireSupporterRegistrationConsent,
  requireSupporterVoteIntentionConsent,
} from '@/utilities/campaignConsent'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneLocks'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { POSTGRES_DEDUP_LOCK_MESSAGE } from '@/utilities/postgresTransactionLocks'
import {
  isPreviewErrorRow,
  isSupporterImportOkRow,
  type SupporterImportPreviewResult,
  type SupporterImportPreviewRow,
  type SupporterImportPreviewRowBase,
} from '@/utilities/supporter/supporterImport'
import { bulkInsertSupporterImport } from '@/utilities/supporter/supporterImportBulk'
import {
  deleteSupporterImportBatch,
  issueSupporterImportToken,
  loadSupporterImportBatch,
  storeSupporterImportBatch,
  verifySupporterImportToken,
} from '@/utilities/supporter/supporterImportToken'

const MAX_IMPORT_ROWS = 5000

/** On-screen preview is capped; the full ok set is staged server-side (Phase 5). */
const SUPPORTER_IMPORT_SAMPLE_SIZE = 100

const escapeCsvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`

const buildSupporterImportErrorReportCsv = (rows: SupporterImportPreviewRow[]): string => {
  const header = 'linha,nome,telefone,municipio,intencao,status\n'
  const body = rows
    .filter(isPreviewErrorRow)
    .map(
      (row) =>
        `${row.line},${escapeCsvCell(row.nome)},${escapeCsvCell(row.telefone)},${escapeCsvCell(row.municipio)},${escapeCsvCell(row.intencao)},${row.status}`,
    )
    .join('\n')
  return header + body
}

const getFreshCoordinatorActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> =>
  reloadCoordinatorActor(
    payload,
    actor,
    'Somente o Coordenador Geral pode importar apoiadores.',
    req,
  )

const normalizeImportHeader = (header: string): string =>
  header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')

const mapImportHeader = (header: string): string | null => {
  const normalized = normalizeImportHeader(header)
  const aliases: Record<string, string> = {
    nome: 'nome',
    name: 'nome',
    telefone: 'telefone',
    phone: 'telefone',
    celular: 'telefone',
    municipio: 'municipio',
    cidade: 'municipio',
    city: 'municipio',
    intencao: 'intencao',
    intencao_de_voto: 'intencao',
    vote_intention: 'intencao',
  }
  return aliases[normalized] ?? null
}

const parseVoteIntentionCell = (value: string): SupporterVoteIntention | undefined | 'invalid' => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const normalized = normalizeImportHeader(trimmed).replace(/-/g, '_')
  const aliases: Record<string, SupporterVoteIntention> = {
    certo: 'certo',
    tende_a_certo: 'tende_a_certo',
    tende: 'tende_a_certo',
    indeciso: 'indeciso',
    outro: 'outro',
  }
  return aliases[normalized] ?? 'invalid'
}

export const previewSupporterImportText = async (
  payload: Payload,
  actor: CampaignUser,
  csvText: string,
): Promise<SupporterImportPreviewResult> => {
  const currentActor = await getFreshCoordinatorActor(payload, actor)
  await requireSupporterRegistrationConsent(payload)
  await requireSupporterVoteIntentionConsent(payload)

  let records: Record<string, string>[]
  try {
    records = parse(csvText, {
      columns: (headers: string[]) =>
        headers.map((header) => {
          const mapped = mapImportHeader(header)
          if (!mapped) return `__unknown_${header}`
          return mapped
        }),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[]
  } catch {
    throw new Error(SUPPORTER_IMPORT_CSV_UNREADABLE_MESSAGE)
  }

  if (records.length === 0) {
    throw new Error(SUPPORTER_IMPORT_CSV_EMPTY_MESSAGE)
  }
  if (records.length > MAX_IMPORT_ROWS) {
    throw new Error(supporterImportCsvTooManyRowsMessage(MAX_IMPORT_ROWS))
  }

  const unknownColumns = Object.keys(records[0] ?? {}).filter((key) => key.startsWith('__unknown_'))
  if (unknownColumns.length > 0) {
    throw new Error(supporterImportCsvUnknownColumnsMessage(unknownColumns))
  }

  const phonesInFile = new Set<string>()
  const rows: SupporterImportPreviewRow[] = []

  for (const [index, record] of records.entries()) {
    const line = index + 2
    const nome = String(record.nome ?? '').trim()
    const telefoneRaw = String(record.telefone ?? '').trim()
    const municipioRaw = String(record.municipio ?? '').trim()
    const intencaoRaw = String(record.intencao ?? '').trim()
    const base: SupporterImportPreviewRowBase = {
      line,
      nome,
      telefone: telefoneRaw,
      municipio: municipioRaw,
      intencao: intencaoRaw,
    }

    if (nome.length < 2) {
      rows.push({ ...base, status: 'nome_invalido' })
      continue
    }

    const normalizedPhone = normalizeBrazilianPhone(telefoneRaw)
    if (!normalizedPhone) {
      rows.push({ ...base, status: 'telefone_invalido' })
      continue
    }

    let canonicalCity: string | undefined
    if (municipioRaw) {
      const city = resolveBahiaMunicipality(municipioRaw)
      if (!city) {
        rows.push({ ...base, status: 'municipio_nao_reconhecido', normalizedPhone })
        continue
      }
      canonicalCity = city
    }

    const voteIntention = parseVoteIntentionCell(intencaoRaw)
    if (voteIntention === 'invalid') {
      rows.push({ ...base, status: 'intencao_invalida', normalizedPhone, canonicalCity })
      continue
    }

    if (phonesInFile.has(normalizedPhone)) {
      rows.push({
        ...base,
        status: 'duplicado_pelo_telefone',
        normalizedPhone,
        canonicalCity,
        voteIntention,
      })
      continue
    }
    phonesInFile.add(normalizedPhone)

    rows.push({
      ...base,
      status: 'ok',
      normalizedPhone,
      canonicalCity,
      voteIntention,
    })
  }

  // Duplicate against an existing supporter without municipality (Contact reuse alone is OK).
  const candidatePhones = [
    ...new Set(rows.filter(isSupporterImportOkRow).map((row) => row.normalizedPhone)),
  ]

  if (candidatePhones.length > 0) {
    const contacts = await payload.find({
      collection: 'contact',
      where: { phone: { in: candidatePhones } },
      depth: 0,
      // No LIMIT: a phone can now legitimately match many fichas (C111), so a
      // finite limit would silently miss a shared phone past the cutoff and
      // the preview would promise rows the confirm then aborts.
      limit: 0,
      pagination: false,
      select: { phone: true },
      overrideAccess: true,
    })
    // C111 — the phone is not unique: a CSV phone resolving to two or more
    // fichas cannot be matched to a person, so every row with that phone is
    // flagged for manual resolution (never a silent "last one wins").
    const contactByPhone = new Map<string, number>()
    const sharedPhones = new Set<string>()
    for (const doc of contacts.docs) {
      if (!doc.phone) continue
      if (contactByPhone.has(doc.phone)) {
        sharedPhones.add(doc.phone)
        continue
      }
      contactByPhone.set(doc.phone, doc.id)
    }
    const contactIDs = [...contactByPhone.values()]

    const existingSupporters = await payload.find({
      collection: 'supporter',
      where: {
        and: [{ contact: { in: contactIDs } }, { municipality: { exists: false } }],
      },
      depth: 0,
      limit: contactIDs.length,
      pagination: false,
      select: { contact: true },
      overrideAccess: true,
    })
    const supporterContactIDs = new Set(
      existingSupporters.docs
        .map((doc) => relationshipId(doc.contact))
        .filter((id): id is number => id !== null),
    )

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      if (!row || !isSupporterImportOkRow(row)) continue
      if (sharedPhones.has(row.normalizedPhone)) {
        rows[index] = { ...row, status: 'telefone_compartilhado' }
        continue
      }
      const contactID = contactByPhone.get(row.normalizedPhone)
      if (contactID && supporterContactIDs.has(contactID)) {
        rows[index] = { ...row, status: 'duplicado_pelo_telefone' }
      }
    }
  }

  const counts = {
    ok: rows.filter(isSupporterImportOkRow).length,
    duplicate: rows.filter((row) => row.status === 'duplicado_pelo_telefone').length,
    error: rows.filter((row) => row.status !== 'ok' && row.status !== 'duplicado_pelo_telefone')
      .length,
  }

  const okRows = rows.filter(isSupporterImportOkRow).map((row) => ({
    nome: row.nome,
    telefone: row.normalizedPhone,
    municipio: row.canonicalCity,
    intencao: row.voteIntention,
  }))

  const errorReportCsv = buildSupporterImportErrorReportCsv(rows)
  const sampleRows = rows.slice(0, SUPPORTER_IMPORT_SAMPLE_SIZE)

  // Stage the full ok set server-side keyed by an HMAC-signed token so the wizard
  // never has to hold/re-send thousands of rows across the Server Action boundary.
  const issued = issueSupporterImportToken(currentActor.id)
  await storeSupporterImportBatch(payload, issued.batchId, {
    actorID: currentActor.id,
    expiresAt: issued.expiresAt,
    okRows,
  })

  return {
    counts,
    sampleRows,
    errorReportCsv,
    importToken: issued.token,
  }
}

export const previewSupporterImport = async (csvText: string) => {
  const { payload, actor } = await getCampaignActionContext()
  return previewSupporterImportText(payload, actor, csvText)
}

export const confirmSupporterImportRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => {
  const data = supporterImportConfirmSchema.parse(input)

  // Verify the HMAC token and load the staged batch BEFORE opening the write
  // transaction, so an invalid/expired token is rejected without holding locks.
  const verified = verifySupporterImportToken(data.importToken, actor.id)
  const batch = await loadSupporterImportBatch(payload, verified.batchId, actor.id)
  if (batch.okRows.length === 0) {
    throw new Error(SUPPORTER_IMPORT_BATCH_EMPTY_MESSAGE)
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshCoordinatorActor(payload, actor, req)
      const registrationConsent = await requireSupporterRegistrationConsent(payload, req)
      const voteIntentionConsent = await requireSupporterVoteIntentionConsent(payload, req)

      if (payload.db.name !== 'postgres') {
        throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
      }

      const phones = [...new Set(batch.okRows.map((row) => row.telefone))]
      await acquireContactPhoneLocks(payload, req, phones)

      const consentNote =
        data.consentNote ??
        'Importação CSV com atestado do operador sobre consentimento dos titulares.'

      const result = await bulkInsertSupporterImport({
        payload,
        req,
        actorID: currentActor.id,
        rows: batch.okRows,
        registrationConsent,
        voteIntentionConsent,
        consentNote,
      })

      // Single-use token: drop the staged batch once the import commits.
      await deleteSupporterImportBatch(payload, verified.batchId, req)
      return result
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação de importação de apoiadores.' },
  )
}

export const confirmSupporterImport = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  return confirmSupporterImportRecord(payload, actor, input)
}
