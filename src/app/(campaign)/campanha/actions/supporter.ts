'use server'

import { parse } from 'csv-parse/sync'
import type { Payload } from 'payload'

import {
  resolveBahiaMunicipality,
  supporterCreateSchema,
  supporterImportConfirmSchema,
  supporterRemoveSchema,
  supporterVoteIntentionSchema,
  type SupporterVoteIntention,
} from '@/lib/schemas/supporter'
import type { CampaignUser, Contact } from '@/payload-types'
import {
  getCampaignActionContext,
  reloadCoordinatorActor,
  reloadStaffActor,
} from '@/utilities/campaignActionContext'
import {
  requireSupporterRegistrationConsent,
  requireSupporterVoteIntentionConsent,
  type ConsentDescriptor,
} from '@/utilities/campaignConsent'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { normalizeBrazilianPhone } from '@/utilities/phone'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import { isUniqueSupporterConflict } from '@/utilities/supporterErrors'
import {
  isPreviewErrorRow,
  isSupporterImportOkRow,
  type SupporterImportPreviewResult,
  type SupporterImportPreviewRow,
  type SupporterImportPreviewRowBase,
} from '@/utilities/supporterImport'
import { bulkInsertSupporterImport } from '@/utilities/supporterImportBulk'
import {
  deleteSupporterImportBatch,
  issueSupporterImportToken,
  loadSupporterImportBatch,
  storeSupporterImportBatch,
  verifySupporterImportToken,
} from '@/utilities/supporterImportToken'

export type {
  SupporterImportOkRow,
  SupporterImportPreviewResult,
  SupporterImportPreviewRow,
  SupporterImportRowStatus,
} from '@/utilities/supporterImport'

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

const getFreshStaffActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> =>
  reloadStaffActor(
    payload,
    actor,
    'Somente a coordenação e a assessoria podem gerenciar apoiadores.',
    req,
  )

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

export const assertMunicipalityManagement = async (
  payload: Payload,
  actor: CampaignUser,
  municipalityID: number,
  req?: PayloadTransactionRequest,
) =>
  payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    user: actor,
    overrideAccess: false,
    req,
  })

const assertCanManageSupporter = async (
  payload: Payload,
  actor: CampaignUser,
  supporterID: number,
  req?: PayloadTransactionRequest,
) =>
  payload.findByID({
    collection: 'supporter',
    id: supporterID,
    depth: 0,
    user: actor,
    overrideAccess: false,
    req,
  })

export const upsertContactByPhone = async ({
  payload,
  req,
  phone,
  name,
  email,
  city,
}: {
  payload: Payload
  req: PayloadTransactionRequest
  phone: string
  name: string
  email?: string
  city?: string
}): Promise<{ contactID: number; reused: boolean }> => {
  const contacts = await payload.find({
    collection: 'contact',
    where: { phone: { equals: phone } },
    depth: 0,
    limit: 2,
    pagination: false,
    overrideAccess: true,
    req,
  })

  if (contacts.totalDocs > 1) {
    throw new Error(
      'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
    )
  }

  const existing = contacts.docs[0]
  if (existing) {
    return { contactID: existing.id, reused: true }
  }

  const contact = await payload.create({
    collection: 'contact',
    data: {
      name,
      phone,
      email,
      state: 'BA' as Contact['state'],
      city,
    },
    depth: 0,
    overrideAccess: true,
    // Callers of upsertContactByPhone have already acquired the phone advisory
    // lock in the same transaction, so the Contact phone-invariant hook can
    // skip its redundant lock+availability check.
    context: { skipContactPhoneInvariant: true },
    req,
  })

  return { contactID: contact.id, reused: false }
}

const createValidatedSupporter = async (payload: Payload, actor: CampaignUser, input: unknown) => {
  const data = supporterCreateSchema.parse(input)

  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await getFreshStaffActor(payload, actor, req)

        if (data.municipality) {
          await assertMunicipalityManagement(payload, currentActor, data.municipality, req)
        } else if (currentActor.role !== 'coordinator') {
          throw new Error('Somente o Coordenador Geral pode cadastrar apoiadores sem município.')
        }

        const registrationConsent = await requireSupporterRegistrationConsent(
          payload,
          req,
          'Consentimento de cadastro de apoiador ainda não configurado.',
        )

        let voteIntentionConsent: ConsentDescriptor | null = null
        if (data.voteIntention) {
          voteIntentionConsent = await requireSupporterVoteIntentionConsent(
            payload,
            req,
            'Consentimento de intenção de voto ainda não configurado.',
          )
        }

        if (payload.db.name !== 'postgres') {
          throw new Error('O bloqueio de deduplicação exige o adaptador PostgreSQL.')
        }

        await acquireContactPhoneLocks(payload, req, [data.phone])
        const { contactID, reused } = await upsertContactByPhone({
          payload,
          req,
          phone: data.phone,
          name: data.name,
          email: data.email,
          city: data.city,
        })

        const supporter = await payload.create({
          collection: 'supporter',
          data: {
            contact: contactID,
            municipality: data.municipality,
            voteIntention: data.voteIntention,
            source: 'manual',
            consent: registrationConsent.id,
            consentContentHash: registrationConsent.contentHash,
            consentedAt: new Date().toISOString(),
            ...(voteIntentionConsent && data.voteIntention
              ? {
                  voteIntentionConsent: voteIntentionConsent.id,
                  voteIntentionConsentContentHash: voteIntentionConsent.contentHash,
                  voteIntentionConsentedAt: new Date().toISOString(),
                }
              : {}),
            createdBy: currentActor.id,
          },
          depth: 0,
          overrideAccess: true,
          req,
        })

        return { ...supporter, contactReused: reused }
      },
      { beginFailureMessage: 'Não foi possível iniciar a transação de cadastro do apoiador.' },
    )
  } catch (error) {
    if (isUniqueSupporterConflict(error)) {
      throw new Error('Esta pessoa já está cadastrada como apoiador nesta Praça.')
    }
    throw error
  }
}

export const createSupporterRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => createValidatedSupporter(payload, actor, input)

export const createSupporter = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  return createValidatedSupporter(payload, actor, input)
}

export const setSupporterVoteIntentionRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => {
  const data = supporterVoteIntentionSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshStaffActor(payload, actor, req)
      await assertCanManageSupporter(payload, currentActor, data.id, req)

      const voteIntentionConsent = await requireSupporterVoteIntentionConsent(
        payload,
        req,
        'Consentimento de intenção de voto ainda não configurado.',
      )

      return payload.update({
        collection: 'supporter',
        id: data.id,
        data: {
          voteIntention: data.voteIntention,
          voteIntentionConsent: voteIntentionConsent.id,
          voteIntentionConsentContentHash: voteIntentionConsent.contentHash,
          voteIntentionConsentedAt: new Date().toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação de intenção de voto.' },
  )
}

export const setSupporterVoteIntention = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  return setSupporterVoteIntentionRecord(payload, actor, input)
}

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
    throw new Error('Não foi possível ler o CSV. Verifique o formato e tente novamente.')
  }

  if (records.length === 0) {
    throw new Error('O CSV está vazio.')
  }
  if (records.length > MAX_IMPORT_ROWS) {
    throw new Error(`O CSV excede o limite de ${MAX_IMPORT_ROWS} linhas.`)
  }

  const unknownColumns = Object.keys(records[0] ?? {}).filter((key) => key.startsWith('__unknown_'))
  if (unknownColumns.length > 0) {
    throw new Error(
      `Colunas não reconhecidas no CSV: ${unknownColumns
        .map((column) => column.replace(/^__unknown_/, ''))
        .join(', ')}. Use apenas nome, telefone, municipio e intencao.`,
    )
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
      limit: candidatePhones.length,
      pagination: false,
      select: { phone: true },
      overrideAccess: true,
    })
    const contactByPhone = new Map(contacts.docs.map((doc) => [doc.phone, doc.id] as const))
    const contactIDs = [...contactByPhone.values()]

    if (contactIDs.length > 0) {
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
        const contactID = contactByPhone.get(row.normalizedPhone)
        if (contactID && supporterContactIDs.has(contactID)) {
          rows[index] = { ...row, status: 'duplicado_pelo_telefone' }
        }
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
    throw new Error('O lote de importação não contém apoiadores válidos.')
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshCoordinatorActor(payload, actor, req)
      const registrationConsent = await requireSupporterRegistrationConsent(payload, req)
      const voteIntentionConsent = await requireSupporterVoteIntentionConsent(payload, req)

      if (payload.db.name !== 'postgres') {
        throw new Error('O bloqueio de deduplicação exige o adaptador PostgreSQL.')
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

const contactHasOtherJoins = async (
  payload: Payload,
  contactID: number,
  excludeSupporterID: number,
  req?: PayloadTransactionRequest,
): Promise<boolean> => {
  const [leaderships, signatures, subscriptions, supporters] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'signature',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'subscription',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'supporter',
      where: {
        and: [{ contact: { equals: contactID } }, { id: { not_equals: excludeSupporterID } }],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    }),
  ])

  return (
    leaderships.totalDocs > 0 ||
    signatures.totalDocs > 0 ||
    subscriptions.totalDocs > 0 ||
    supporters.totalDocs > 0
  )
}

const anonymizeContact = async (
  payload: Payload,
  contactID: number,
  req: PayloadTransactionRequest,
) => {
  // Must match Contact phone validation: DDD + 9 + 8 digits (`^[1-9]{2}9\d{8}$`).
  const tombstonePhone = `999${String(contactID).padStart(8, '0')}`
  await acquireContactPhoneLocks(payload, req, [tombstonePhone])
  await payload.update({
    collection: 'contact',
    id: contactID,
    data: {
      name: 'Titular removido',
      email: null,
      phone: tombstonePhone,
      gender: null,
      city: null,
      postalCode: null,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

export const removeSupporterDataRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => {
  const data = supporterRemoveSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshStaffActor(payload, actor, req)
      const supporter = await assertCanManageSupporter(payload, currentActor, data.id, req)
      const contactID = requireRelationshipId(supporter.contact)

      await payload.delete({
        collection: 'supporter',
        id: data.id,
        overrideAccess: true,
        req,
      })

      const hasOtherJoins = await contactHasOtherJoins(payload, contactID, data.id, req)
      if (!hasOtherJoins) {
        await anonymizeContact(payload, contactID, req)
      }

      return { removed: true, contactAnonymized: !hasOtherJoins }
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação de remoção de dados.' },
  )
}

export const removeSupporterData = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  return removeSupporterDataRecord(payload, actor, input)
}
