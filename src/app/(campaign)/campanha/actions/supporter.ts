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
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
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

const MAX_IMPORT_ROWS = 5000

export type SupporterImportRowStatus =
  | 'ok'
  | 'duplicado_pelo_telefone'
  | 'telefone_invalido'
  | 'municipio_nao_reconhecido'
  | 'nome_invalido'
  | 'intencao_invalida'

type SupporterImportPreviewRowBase = {
  line: number
  nome: string
  telefone: string
  municipio: string
  intencao: string
}

export type SupporterImportOkRow = SupporterImportPreviewRowBase & {
  status: 'ok'
  normalizedPhone: string
  canonicalCity?: string
  voteIntention?: SupporterVoteIntention
}

export type SupporterImportPreviewRow =
  | SupporterImportOkRow
  | (SupporterImportPreviewRowBase & {
      status: Exclude<SupporterImportRowStatus, 'ok'>
      normalizedPhone?: string
      canonicalCity?: string
      voteIntention?: SupporterVoteIntention
    })

export const isSupporterImportOkRow = (
  row: SupporterImportPreviewRow,
): row is SupporterImportOkRow => row.status === 'ok'

export type SupporterImportPreviewResult = {
  rows: SupporterImportPreviewRow[]
  counts: {
    ok: number
    duplicate: number
    error: number
  }
}

const getFreshStaffActor = async (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)

  if (currentActor.role !== 'geral' && currentActor.role !== 'coordenador') {
    throw new Error('Somente a coordenação pode gerenciar apoiadores.')
  }

  return currentActor
}

const getFreshGeneralActor = async (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  if (currentActor.role !== 'geral') {
    throw new Error('Somente a coordenação geral pode importar apoiadores.')
  }
  return currentActor
}

const assertNucleusManagement = async (
  payload: Payload,
  actor: CampaignUser,
  nucleusID: number,
  req?: PayloadTransactionRequest,
) =>
  payload.findByID({
    collection: 'electoralNucleus',
    id: nucleusID,
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

const isUniqueSupporterConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /supporter.*contact.*nucleus|supporter_contact_nucleus|nulls_not_distinct|duplicate key/i.test(
    message,
  )
}

const upsertContactByPhone = async ({
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

        if (data.nucleus) {
          await assertNucleusManagement(payload, currentActor, data.nucleus, req)
        } else if (currentActor.role !== 'geral') {
          throw new Error('Somente a coordenação geral pode cadastrar apoiadores sem núcleo.')
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
            nucleus: data.nucleus,
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
      throw new Error('Esta pessoa já está cadastrada como apoiador neste núcleo.')
    }
    throw error
  }
}

export const createSupporterRecord = (payload: Payload, actor: CampaignUser, input: unknown) =>
  createValidatedSupporter(payload, actor, input)

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
  await getFreshGeneralActor(payload, actor)
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

  // Duplicate against an existing supporter without nucleus (Contact reuse alone is OK).
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
          and: [{ contact: { in: contactIDs } }, { nucleus: { exists: false } }],
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

  return { rows, counts }
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

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshGeneralActor(payload, actor, req)
      const registrationConsent = await requireSupporterRegistrationConsent(payload, req)
      const voteIntentionConsent = await requireSupporterVoteIntentionConsent(payload, req)

      if (payload.db.name !== 'postgres') {
        throw new Error('O bloqueio de deduplicação exige o adaptador PostgreSQL.')
      }

      const phones = [...new Set(data.rows.map((row) => row.telefone))]
      await acquireContactPhoneLocks(payload, req, phones)

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

      for (const row of data.rows) {
        if (contactIdByPhone.has(row.telefone)) continue
        const { contactID } = await upsertContactByPhone({
          payload,
          req,
          phone: row.telefone,
          name: row.nome,
          city: row.municipio,
        })
        contactIdByPhone.set(row.telefone, contactID)
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

      let created = 0
      let skipped = 0
      const errors: Array<{ telefone: string; message: string }> = []
      const consentNote =
        data.consentNote ??
        'Importação CSV com atestado do operador sobre consentimento dos titulares.'
      const consentedAt = new Date().toISOString()

      for (const row of data.rows) {
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

        try {
          await payload.create({
            collection: 'supporter',
            data: {
              contact: contactID,
              source: 'import_csv',
              voteIntention: row.intencao,
              consent: registrationConsent.id,
              consentContentHash: registrationConsent.contentHash,
              consentedAt,
              consentNote,
              ...(row.intencao
                ? {
                    voteIntentionConsent: voteIntentionConsent.id,
                    voteIntentionConsentContentHash: voteIntentionConsent.contentHash,
                    voteIntentionConsentedAt: consentedAt,
                  }
                : {}),
              createdBy: currentActor.id,
            },
            depth: 0,
            overrideAccess: true,
            req,
          })
          supporterContactIDs.add(contactID)
          created += 1
        } catch (error) {
          skipped += 1
          errors.push({
            telefone: row.telefone,
            message: error instanceof Error ? error.message : 'Erro ao importar linha.',
          })
        }
      }

      return { created, skipped, errors }
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
