'use server'

import type { Payload } from 'payload'

import {
  leadershipCreateSchema,
  leadershipInternalUpdateSchema,
  type LeadershipInternalUpdateInput,
} from '@/lib/schemas/leadership'
import type { CampaignUser, Contact } from '@/payload-types'
import { getAdvisorMunicipalityIds } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

const getFreshStaffActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> =>
  reloadStaffActor(
    payload,
    actor,
    'Somente a coordenação e a assessoria podem gerenciar lideranças.',
    req,
  )

/** Advisors may only link leaderships to municipalities they administer. */
const assertMunicipalitiesWithinScope = async (
  payload: Payload,
  actor: CampaignUser,
  municipalityIDs: number[],
  req?: PayloadTransactionRequest,
) => {
  if (actor.role !== 'advisor') return

  const administered = new Set(await getAdvisorMunicipalityIds(payload, actor.id, req))
  const outside = municipalityIDs.filter((id) => !administered.has(id))
  if (outside.length > 0) {
    throw new Error('Você só pode vincular lideranças aos municípios que assessora.')
  }
}

const isUniqueLeadershipConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  if (/leadership_contact|duplicate key/i.test(message)) {
    return true
  }

  if (!(error instanceof Error) || error.name !== 'ValidationError') return false

  return /contact(?:_id)?/i.test(JSON.stringify(error))
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
        await assertMunicipalitiesWithinScope(payload, currentActor, data.municipalities, req)
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
          let city: string | null = null
          if (data.municipalities.length === 1) {
            const municipality = await payload.findByID({
              collection: 'municipality',
              id: data.municipalities[0]!,
              depth: 0,
              select: { city: true },
              overrideAccess: true,
              req,
            })
            city = municipality.city
          }
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
            municipalities: data.municipalities,
            organizations: data.organizations ?? [],
            stateDeputies: data.stateDeputies ?? [],
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
      throw new Error(
        'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novos municípios.',
      )
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
  const { id, municipalities, organizations, stateDeputies, ...data } =
    leadershipInternalUpdateSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)

  // Row access verifies the current record is in the actor's scope.
  const current = await payload.findByID({
    collection: 'leadership',
    id,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })

  if (municipalities !== undefined) {
    await assertMunicipalitiesWithinScope(payload, currentActor, municipalities)
  }

  return payload.update({
    collection: 'leadership',
    id: current.id,
    data: {
      ...data,
      ...(municipalities === undefined ? {} : { municipalities }),
      ...(organizations === undefined ? {} : { organizations: organizations ?? [] }),
      ...(stateDeputies === undefined ? {} : { stateDeputies: stateDeputies ?? [] }),
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const listMunicipalityLeaderships = async (
  payload: Payload,
  actor: CampaignUser,
  municipalityID: number,
) => {
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.find({
    collection: 'leadership',
    where: { municipalities: { in: [municipalityID] } },
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
