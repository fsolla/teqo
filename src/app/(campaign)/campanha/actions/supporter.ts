'use server'

import type { Payload } from 'payload'

import { requireRelationshipId } from '@/lib/relationship'
import {
  SUPPORTER_DUPLICATE_MESSAGE,
  SUPPORTER_STAFF_MESSAGE,
  SUPPORTER_UNSCOPED_COORDINATOR_MESSAGE,
  supporterCreateSchema,
  supporterRemoveSchema,
  supporterVoteIntentionSchema,
} from '@/lib/schemas/supporter'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import {
  requireSupporterRegistrationConsent,
  requireSupporterVoteIntentionConsent,
  type ConsentDescriptor,
} from '@/utilities/campaignConsent'
import { findOrCreateContactByPhone } from '@/utilities/contactIdentity'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { isUniqueSupporterConflict } from '@/utilities/supporter/supporterErrors'

import {
  confirmSupporterImport as confirmSupporterImportAction,
  confirmSupporterImportRecord as confirmSupporterImportRecordAction,
  previewSupporterImport as previewSupporterImportAction,
  previewSupporterImportText as previewSupporterImportTextAction,
} from './supporterImport'

const getFreshStaffActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => reloadStaffActor(payload, actor, SUPPORTER_STAFF_MESSAGE, req)

const assertMunicipalityManagement = async (
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
          throw new Error(SUPPORTER_UNSCOPED_COORDINATOR_MESSAGE)
        }

        const registrationConsent = await requireSupporterRegistrationConsent(payload, req)

        let voteIntentionConsent: ConsentDescriptor | null = null
        if (data.voteIntention) {
          voteIntentionConsent = await requireSupporterVoteIntentionConsent(payload, req)
        }

        const { contactID, reused } = await findOrCreateContactByPhone({
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
      throw new Error(SUPPORTER_DUPLICATE_MESSAGE)
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

      const voteIntentionConsent = await requireSupporterVoteIntentionConsent(payload, req)

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

      // Intentional admin bypass (LGPD titular-rights path): `canDeleteSupporter`
      // is admin-only by design, but THIS action is the staff-driven data-removal
      // flow — the actor's manage scope was already proven by
      // `assertCanManageSupporter` above, and the row being deleted is exactly the
      // one that scope check loaded. The asymmetry is deliberate: day-to-day
      // deletes stay admin-only while the documented removal request path works.
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
