'use server'

import type { Payload } from 'payload'

import {
  supporterCreateSchema,
  supporterRemoveSchema,
  supporterVoteIntentionSchema,
} from '@/lib/schemas/supporter'
import type { CampaignUser, Contact } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import {
  requireSupporterRegistrationConsent,
  requireSupporterVoteIntentionConsent,
  type ConsentDescriptor,
} from '@/utilities/campaignConsent'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { requireRelationshipId } from '@/utilities/relationship'
import { isUniqueSupporterConflict } from '@/utilities/supporterErrors'

import {
  confirmSupporterImport as confirmSupporterImportAction,
  confirmSupporterImportRecord as confirmSupporterImportRecordAction,
  previewSupporterImport as previewSupporterImportAction,
  previewSupporterImportText as previewSupporterImportTextAction,
} from './supporterImport'

export type {
  SupporterImportOkRow,
  SupporterImportPreviewResult,
  SupporterImportPreviewRow,
  SupporterImportRowStatus,
} from '@/utilities/supporterImport'

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
      throw new Error('Esta pessoa já está cadastrada como apoiador neste município.')
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

// ---------------------------------------------------------------------------
// CSV import pipeline — implementation lives in ./supporterImport. A top-level
// `'use server'` module cannot re-export values (only async functions defined
// here), so these async wrappers keep the import sites of this module stable.
// ---------------------------------------------------------------------------

export const previewSupporterImportText = async (
  payload: Payload,
  actor: CampaignUser,
  csvText: string,
) => previewSupporterImportTextAction(payload, actor, csvText)

export const previewSupporterImport = async (csvText: string) =>
  previewSupporterImportAction(csvText)

export const confirmSupporterImportRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => confirmSupporterImportRecordAction(payload, actor, input)

export const confirmSupporterImport = async (input: unknown) => confirmSupporterImportAction(input)

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
