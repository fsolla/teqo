'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextMunicipalityIdsAfterLeadershipMembership } from '@/lib/leadershipMunicipalityMembership'
import { nextStateDeputyIdsAfterMembership } from '@/lib/leadershipStateDeputyMembership'
import {
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  leadershipCreateSchema,
  leadershipInternalUpdateSchema,
  leadershipMunicipalitiesMembershipSchema,
  leadershipStateDeputyMembershipSchema,
  type LeadershipInternalUpdateInput,
  type LeadershipMunicipalitiesMembershipInput,
  type LeadershipStateDeputyMembershipInput,
} from '@/lib/schemas/leadership'
import type { CampaignUser, Contact } from '@/payload-types'
import { getAdvisorMunicipalityIds } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { uniqueRelationshipIds } from '@/utilities/relationship'

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
    throw new Error(LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE)
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

const revalidateLeadershipStateDeputyPaths = (leadershipId: number, stateDeputySlug?: string) => {
  revalidatePath('/campanha/liderancas', 'page')
  revalidatePath(`/campanha/liderancas/${leadershipId}`, 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
  if (stateDeputySlug) {
    revalidatePath(`/campanha/dobradinhas/${stateDeputySlug}`, 'page')
  }
}

/**
 * Delta write for one chip in the "Dobradinhas" column of `/campanha/liderancas`
 * (B31) — the other side of the same `leadership.stateDeputies` relation that
 * `updateLeadershipInternalRecord` replaces wholesale from the ficha form.
 * Under auto-save-per-chip a replace would let two actors on the same ficha
 * clobber each other, so this locks per leadership and writes only the delta.
 */
export const setLeadershipStateDeputyMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipStateDeputyMembershipInput,
) => {
  const { leadershipId, stateDeputyId, assigned } =
    leadershipStateDeputyMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshStaffActor(payload, actor, req)

      await acquireTextAdvisoryLocks(payload, req, [`leadership-state-deputies:${leadershipId}`])

      // Row access verifies the leadership is in the actor's scope (same
      // guard `updateLeadershipInternalRecord` relies on).
      const current = await payload.findByID({
        collection: 'leadership',
        id: leadershipId,
        depth: 0,
        select: { stateDeputies: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const currentStateDeputyIDs = uniqueRelationshipIds(current.stateDeputies)
      const nextStateDeputyIDs = nextStateDeputyIdsAfterMembership(
        currentStateDeputyIDs,
        stateDeputyId,
        assigned,
      )

      // No-op: nothing to write, and nothing for the caller to revalidate —
      // skip the slug lookup below, which exists only to target that revalidate.
      if (nextStateDeputyIDs === null) {
        return { leadership: current, stateDeputySlug: undefined }
      }

      // Intentional admin bypass: only used to resolve the slug of the
      // touched deputy for a targeted revalidate; existence is otherwise
      // enforced by Payload's relationship validation on `update`.
      const stateDeputySlug = (
        await payload.findByID({
          collection: 'stateDeputy',
          id: stateDeputyId,
          depth: 0,
          select: { slug: true },
          overrideAccess: true,
          req,
        })
      ).slug

      const updated = await payload.update({
        collection: 'leadership',
        id: leadershipId,
        data: { stateDeputies: nextStateDeputyIDs },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      return { leadership: updated, stateDeputySlug }
    },
    { beginFailureMessage: 'Não foi possível atualizar as dobradinhas.' },
  )
}

export const setLeadershipStateDeputyMembership = async (
  input: LeadershipStateDeputyMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, stateDeputySlug } = await setLeadershipStateDeputyMembershipRecord(
    payload,
    actor,
    input,
  )
  // No-op writes nothing, so there is nothing to revalidate.
  if (stateDeputySlug) revalidateLeadershipStateDeputyPaths(input.leadershipId, stateDeputySlug)
  return leadership
}

const revalidateLeadershipMunicipalityPaths = (
  leadershipId: number,
  municipalitySlugs: readonly string[],
) => {
  revalidatePath('/campanha/liderancas', 'page')
  revalidatePath(`/campanha/liderancas/${leadershipId}`, 'page')
  for (const slug of municipalitySlugs) {
    revalidatePath(`/campanha/municipios/${slug}`, 'page')
  }
}

/**
 * Delta write for the "Municípios" column of `/campanha/liderancas` (B34) —
 * adds or removes a set of municipalities (one chip, or a whole território/ZE)
 * on `leadership.municipalities`.
 *
 * Deliberately NOT `updateLeadershipInternalRecord`: that one replaces the whole
 * array and revalidates every id against the advisor's scope, which would make a
 * cross-boundary leadership unsavable by the advisor who only owns part of it.
 * Only the *added* ids are scope-checked; removal needs no scope beyond the row
 * access that already resolved the leadership.
 */
export const setLeadershipMunicipalitiesMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipMunicipalitiesMembershipInput,
) => {
  const { leadershipId, municipalityIds, assigned } =
    leadershipMunicipalitiesMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshStaffActor(payload, actor, req)

      await acquireTextAdvisoryLocks(payload, req, [`leadership-municipalities:${leadershipId}`])

      // Row access verifies the leadership is in the actor's scope (same
      // guard `updateLeadershipInternalRecord` relies on).
      const current = await payload.findByID({
        collection: 'leadership',
        id: leadershipId,
        depth: 0,
        select: { municipalities: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const change = nextMunicipalityIdsAfterLeadershipMembership(
        uniqueRelationshipIds(current.municipalities),
        municipalityIds,
        assigned,
      )

      // No-op: nothing to write, and nothing for the caller to revalidate —
      // skip the slug lookup below, which exists only to target that revalidate.
      if (change === null) {
        return { leadership: current, municipalitySlugs: [] }
      }

      // Only the ids the write actually adds: an advisor must stay able to drop a
      // link outside their scope, and re-deriving `added` here could disagree.
      if (change.added.length > 0) {
        await assertMunicipalitiesWithinScope(payload, currentActor, change.added, req)
      }

      // Intentional admin bypass: only used to resolve the slugs of the touched
      // municipalities for a targeted revalidate; existence is otherwise
      // enforced by Payload's relationship validation on `update`.
      const touched = await payload.find({
        collection: 'municipality',
        where: { id: { in: change.changed } },
        depth: 0,
        pagination: false,
        select: { slug: true },
        overrideAccess: true,
        req,
      })

      const updated = await payload.update({
        collection: 'leadership',
        id: leadershipId,
        data: { municipalities: change.next },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      return { leadership: updated, municipalitySlugs: touched.docs.map((doc) => doc.slug) }
    },
    { beginFailureMessage: 'Não foi possível atualizar os municípios da liderança.' },
  )
}

export const setLeadershipMunicipalitiesMembership = async (
  input: LeadershipMunicipalitiesMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, municipalitySlugs } = await setLeadershipMunicipalitiesMembershipRecord(
    payload,
    actor,
    input,
  )
  // No-op writes nothing, so there is nothing to revalidate.
  if (municipalitySlugs.length > 0) {
    revalidateLeadershipMunicipalityPaths(input.leadershipId, municipalitySlugs)
  }
  return leadership
}
