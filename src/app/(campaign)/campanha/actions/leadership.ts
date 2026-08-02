'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { assertCampaignDocCas } from '@/app/(campaign)/campanha/actions/assertCampaignDocCas'
import { nextMunicipalityIdsAfterLeadershipMembership } from '@/lib/leadershipMunicipalityMembership'
import { nextStateDeputyIdsAfterMembership } from '@/lib/leadershipStateDeputyMembership'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STAFF_MESSAGE,
  leadershipCreateSchema,
  leadershipInternalUpdateSchema,
  leadershipMunicipalitiesMembershipSchema,
  leadershipStateDeputyMembershipSchema,
  leadershipWizardCreateSchema,
  leadershipWizardUpdateSchema,
  type LeadershipInternalUpdateInput,
  type LeadershipMunicipalitiesMembershipInput,
  type LeadershipStateDeputyMembershipInput,
  type LeadershipWizardCreateInput,
  type LeadershipWizardUpdateInput,
} from '@/lib/schemas/leadership'
import { assertOpsUpdatedAtCas } from '@/lib/schemas/opsCas'
import type { CampaignUser, Contact } from '@/payload-types'
import { getAdvisorMunicipalityIds } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import {
  acquireContactPhoneLocks,
  assertContactPhoneAvailable,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
} from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import {
  acquireTextAdvisoryLocks,
  POSTGRES_DEDUP_LOCK_MESSAGE,
} from '@/utilities/postgresTransactionLocks'

const getFreshStaffActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => reloadStaffActor(payload, actor, LEADERSHIP_STAFF_MESSAGE, req)

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
          throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
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
          throw new Error(CONTACT_PHONE_AMBIGUOUS_MESSAGE)
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
            exclusive: data.exclusive,
            supportStatus: data.supportStatus,
            notes: data.notes,
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
      throw new Error(LEADERSHIP_DUPLICATE_MESSAGE)
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
  options?: { cas?: boolean },
) => {
  const { id, municipalities, organizations, stateDeputies, baseUpdatedAt, ...data } =
    leadershipInternalUpdateSchema.parse(input)
  const enforceCas = options?.cas === true
  const currentActor = await getFreshStaffActor(payload, actor)

  // Row access verifies the current record is in the actor's scope.
  const current = await payload.findByID({
    collection: 'leadership',
    id,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })

  // Stamp already loaded with the row — avoid a second find via assertCampaignDocCas.
  assertOpsUpdatedAtCas(enforceCas, baseUpdatedAt, current.updatedAt)

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

/** Outbox entry for create — no CAS (new doc). Same write path as `createLeadership`. */
export const createLeadershipCas = async (input: unknown) => createLeadership(input)

export const updateLeadershipInternal = async (input: LeadershipInternalUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateLeadershipInternalRecord(payload, actor, input)
}

export const updateLeadershipInternalCas = async (input: LeadershipInternalUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateLeadershipInternalRecord(payload, actor, input, { cas: true })
}

export const updateLeadershipInternalCasRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipInternalUpdateInput,
) => updateLeadershipInternalRecord(payload, actor, input, { cas: true })

const revalidateLeadershipWizardPaths = (leadershipId: number, municipalitySlug: string) => {
  revalidatePath(`/campanha/liderancas/${leadershipId}`, 'page')
  revalidatePath(`/campanha/municipios/${municipalitySlug}`, 'page')
  revalidatePath('/campanha/liderancas', 'page')
}

const updateLeadershipWizardRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipWizardUpdateInput,
) => {
  const data = leadershipWizardUpdateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await getFreshStaffActor(payload, actor, req)

      const current = await payload.findByID({
        collection: 'leadership',
        id: data.id,
        depth: 1,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const municipalityIDs = uniqueRelationshipIds(current.municipalities)
      await assertMunicipalitiesWithinScope(payload, currentActor, municipalityIDs, req)

      if (payload.db.name !== 'postgres') {
        throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
      }

      const contactID = relationshipId(current.contact)
      if (contactID === null) {
        throw new Error(LEADERSHIP_INVALID_CONTACT_MESSAGE)
      }

      await acquireContactPhoneLocks(payload, req, [data.phone])

      // Intentional admin bypass: staff scope was checked on the leadership; contact
      // PII is updated atomically with the leadership fields in this transaction.
      const contactsWithPhone = await payload.find({
        collection: 'contact',
        where: { phone: { equals: data.phone } },
        depth: 0,
        limit: 2,
        pagination: false,
        overrideAccess: true,
        req,
      })

      if (contactsWithPhone.totalDocs > 1) {
        throw new Error(CONTACT_PHONE_AMBIGUOUS_MESSAGE)
      }

      const phoneOwner = contactsWithPhone.docs[0]
      if (phoneOwner && phoneOwner.id !== contactID) {
        await assertContactPhoneAvailable(payload, req, data.phone, contactID)
      }

      // bypass: contact write is staff-scoped via leadership access check above.
      await payload.update({
        collection: 'contact',
        id: contactID,
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })

      return payload.update({
        collection: 'leadership',
        id: current.id,
        data: {
          exclusive: data.exclusive,
          supportStatus: data.supportStatus,
          notes: data.notes,
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível atualizar a liderança.' },
  )
}

const createLeadershipWizardRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipWizardCreateInput,
) => {
  const data = leadershipWizardCreateSchema.parse(input)
  return createValidatedLeadershipRecord(payload, actor, {
    name: data.name,
    phone: data.phone,
    email: data.email,
    municipalities: [data.municipalityId],
    exclusive: data.exclusive,
    supportStatus: data.supportStatus,
    notes: data.notes,
  })
}

export const updateLeadershipWizard = async (
  input: LeadershipWizardUpdateInput,
  municipalitySlug: string,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const leadership = await updateLeadershipWizardRecord(payload, actor, input)
  revalidateLeadershipWizardPaths(leadership.id, municipalitySlug)
  return leadership
}

export const createLeadershipWizard = async (
  input: LeadershipWizardCreateInput,
  municipalitySlug: string,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const leadership = await createLeadershipWizardRecord(payload, actor, input)
  revalidateLeadershipWizardPaths(leadership.id, municipalitySlug)
  return leadership
}

/**
 * `/campanha/liderancas` — the list the chip was toggled ON — is deliberately
 * NOT here: see `revalidateLeadershipMunicipalityPaths` below for the reason.
 */
const revalidateLeadershipStateDeputyPaths = (leadershipId: number, stateDeputySlug?: string) => {
  revalidatePath(`/campanha/liderancas/${leadershipId}`, 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
  if (stateDeputySlug) {
    revalidatePath(`/campanha/dobradinhas/${stateDeputySlug}`, 'page')
  }
}

const LEADERSHIP_RELATION_LOCK_KEYS = {
  municipalities: 'leadership-municipalities',
  stateDeputies: 'leadership-state-deputies',
} as const

/**
 * Opens a leadership for a delta write on one of its relations: reloads the
 * actor, takes the lock that belongs to THAT relation, and reads the current
 * ids under the actor's row access (the same guard
 * `updateLeadershipInternalRecord` relies on).
 *
 * The pairing is the point: relation and lock key used to be two independent
 * string literals a few lines apart, so a third relation could quietly take a
 * lock that guards a different column. The rest of the two delta writes — the
 * delta shape, the scope assertion, the slug lookup, the return — is genuinely
 * different in each, and hoisting it would cost six callbacks to share ~24 lines.
 */
const openLeadershipForRelationDelta = async <
  Relation extends keyof typeof LEADERSHIP_RELATION_LOCK_KEYS,
>(
  payload: Payload,
  actor: CampaignUser,
  req: PayloadTransactionRequest,
  leadershipId: number,
  relation: Relation,
) => {
  const currentActor = await getFreshStaffActor(payload, actor, req)

  await acquireTextAdvisoryLocks(payload, req, [
    `${LEADERSHIP_RELATION_LOCK_KEYS[relation]}:${leadershipId}`,
  ])

  const current = await payload.findByID({
    collection: 'leadership',
    id: leadershipId,
    depth: 0,
    select: { [relation]: true } as Record<Relation, true>,
    user: currentActor,
    overrideAccess: false,
    req,
  })

  return { currentActor, current }
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
  options?: { cas?: boolean },
) => {
  const { leadershipId, stateDeputyId, assigned, baseUpdatedAt } =
    leadershipStateDeputyMembershipSchema.parse(input)
  const enforceCas = options?.cas === true

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const { currentActor, current } = await openLeadershipForRelationDelta(
        payload,
        actor,
        req,
        leadershipId,
        'stateDeputies',
      )

      await assertCampaignDocCas(payload, {
        collection: 'leadership',
        id: leadershipId,
        actor: currentActor,
        enforceCas,
        baseUpdatedAt,
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

export const setLeadershipStateDeputyMembershipCas = async (
  input: LeadershipStateDeputyMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, stateDeputySlug } = await setLeadershipStateDeputyMembershipRecord(
    payload,
    actor,
    input,
    { cas: true },
  )
  if (stateDeputySlug) revalidateLeadershipStateDeputyPaths(input.leadershipId, stateDeputySlug)
  return leadership
}

/**
 * `/campanha/liderancas` is deliberately absent: the chip cell that calls this
 * IS on that list, and it already shows the result optimistically, so
 * revalidating it re-renders and re-serializes the whole table (plus the 435-row
 * município index it carries) on every toggle, for a change already on screen.
 * The routes below are the ones an actor cannot see from here.
 *
 * Accepted consequence: with the list filtered BY município, dropping that
 * município leaves the row in place until the next navigation instead of making
 * it vanish under the cursor mid-edit.
 */
const revalidateLeadershipMunicipalityPaths = (
  leadershipId: number,
  municipalitySlugs: readonly string[],
) => {
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
  options?: { cas?: boolean },
) => {
  const { leadershipId, municipalityIds, assigned, baseUpdatedAt } =
    leadershipMunicipalitiesMembershipSchema.parse(input)
  const enforceCas = options?.cas === true

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const { currentActor, current } = await openLeadershipForRelationDelta(
        payload,
        actor,
        req,
        leadershipId,
        'municipalities',
      )

      await assertCampaignDocCas(payload, {
        collection: 'leadership',
        id: leadershipId,
        actor: currentActor,
        enforceCas,
        baseUpdatedAt,
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

export const setLeadershipMunicipalitiesMembershipCas = async (
  input: LeadershipMunicipalitiesMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, municipalitySlugs } = await setLeadershipMunicipalitiesMembershipRecord(
    payload,
    actor,
    input,
    { cas: true },
  )
  if (municipalitySlugs.length > 0) {
    revalidateLeadershipMunicipalityPaths(input.leadershipId, municipalitySlugs)
  }
  return leadership
}
