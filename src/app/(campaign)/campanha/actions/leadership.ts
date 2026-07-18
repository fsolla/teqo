'use server'

import type { Payload } from 'payload'

import {
  leadershipCreateSchema,
  leadershipInternalUpdateSchema,
  type LeadershipInternalUpdateInput,
} from '@/lib/schemas/leadership'
import type { CampaignUser, Contact } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { requireRelationshipId } from '@/utilities/relationship'

const getFreshStaffActor = async (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)

  if (currentActor.role !== 'geral' && currentActor.role !== 'coordenador') {
    throw new Error('Somente a coordenação pode gerenciar lideranças.')
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

const isUniqueLeadershipConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  if (/leadership.*contact.*nucleus|leadership_contact_nucleus|duplicate key/i.test(message)) {
    return true
  }

  if (!(error instanceof Error) || error.name !== 'ValidationError') return false

  const details = JSON.stringify(error)
  return /contact(?:_id)?/i.test(details) && /nucleus(?:_id)?/i.test(details)
}

type LeadershipCreateData = ReturnType<typeof leadershipCreateSchema.parse>

const createValidatedLeadershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  data: LeadershipCreateData,
) => {
  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await getFreshStaffActor(payload, actor, req)
        const nucleus = await assertNucleusManagement(payload, currentActor, data.nucleus, req)
        if (payload.db.name !== 'postgres') {
          throw new Error('O bloqueio de deduplicação exige o adaptador PostgreSQL.')
        }
        await acquireContactPhoneLocks(payload, req, [data.phone])
        // Intentional admin bypass: staff scope was freshly checked; these internal reads and
        // writes atomically maintain the normalized Contact ↔ Leadership join.
        const contacts = await payload.find({
          collection: 'contact',
          where: { phone: { equals: data.phone } },
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

        let contactID = contacts.docs[0]?.id
        const contactReused = Boolean(contactID)

        if (!contactID) {
          const cities = Array.isArray(nucleus.cities) ? nucleus.cities : []
          const city = cities.length === 1 ? cities[0] : (nucleus.locality ?? null)
          const contact = await payload.create({
            collection: 'contact',
            data: {
              name: data.name,
              phone: data.phone,
              email: data.email,
              gender: data.gender,
              state: 'BA' as Contact['state'],
              city,
            },
            depth: 0,
            overrideAccess: true,
            req,
          })
          contactID = contact.id
        }

        const leadership = await payload.create({
          collection: 'leadership',
          data: {
            contact: contactID,
            nucleus: data.nucleus,
            sector: data.sector,
            sectorNotes: data.sectorNotes,
            supportStatus: data.supportStatus,
            notes: data.notes,
            consentNote: data.consentNote,
            createdBy: currentActor.id,
          },
          depth: 0,
          overrideAccess: true,
          req,
        })
        return { ...leadership, contactReused }
      },
      { beginFailureMessage: 'Não foi possível iniciar a transação de cadastro da liderança.' },
    )
  } catch (error) {
    if (isUniqueLeadershipConflict(error)) {
      throw new Error('Esta pessoa já está cadastrada como liderança neste núcleo.')
    }

    throw error
  }
}

export const createLeadershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => createValidatedLeadershipRecord(payload, actor, leadershipCreateSchema.parse(input))

export const updateLeadershipInternalRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipInternalUpdateInput,
) => {
  const { id, ...data } = leadershipInternalUpdateSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)
  const current = await payload.findByID({
    collection: 'leadership',
    id,
    depth: 0,
    overrideAccess: true,
  })
  await assertNucleusManagement(payload, currentActor, requireRelationshipId(current.nucleus))

  return payload.update({
    collection: 'leadership',
    id,
    data,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const listNucleusLeaderships = async (
  payload: Payload,
  actor: CampaignUser,
  nucleusID: number,
) => {
  const currentActor = await getFreshStaffActor(payload, actor)
  await assertNucleusManagement(payload, currentActor, nucleusID)

  return payload.find({
    collection: 'leadership',
    where: { nucleus: { equals: nucleusID } },
    depth: 1,
    sort: 'createdAt',
    user: currentActor,
    overrideAccess: false,
  })
}

export const createLeadership = async (input: unknown) => {
  const data = leadershipCreateSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  return createValidatedLeadershipRecord(payload, actor, data)
}

export const updateLeadershipInternal = async (input: LeadershipInternalUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateLeadershipInternalRecord(payload, actor, input)
}
