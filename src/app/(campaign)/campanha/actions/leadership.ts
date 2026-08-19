'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextLeadershipAdvisorIdsAfterMembership } from '@/lib/leadershipAdvisorMembership'
import { nextMunicipalityIdsAfterLeadershipMembership } from '@/lib/leadershipMunicipalityMembership'
import { nextStateDeputyIdsAfterMembership } from '@/lib/leadershipStateDeputyMembership'
import { reorderWithPrimaryPhone } from '@/lib/phone'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE,
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_INVALID_CONTACT_MESSAGE,
  LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE,
  LEADERSHIP_STAFF_MESSAGE,
  leadershipAdvisorMembershipSchema,
  leadershipContactUpdateSchema,
  leadershipCreateSchema,
  leadershipInternalUpdateSchema,
  leadershipMunicipalitiesMembershipSchema,
  leadershipStateDeputyMembershipSchema,
  leadershipWizardCreateSchema,
  leadershipWizardUpdateSchema,
  municipalityLeadershipCreateSchema,
  type LeadershipAdvisorMembershipInput,
  type LeadershipContactUpdateInput,
  type LeadershipInternalUpdateInput,
  type LeadershipMunicipalitiesMembershipInput,
  type LeadershipStateDeputyMembershipInput,
  type LeadershipWizardCreateInput,
  type LeadershipWizardUpdateInput,
  type MunicipalityLeadershipCreateInput,
} from '@/lib/schemas/leadership'
import type { CampaignUser, Contact, Leadership } from '@/payload-types'
import { getWritableMunicipalityIds } from '@/utilities/campaignAccess'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import { findOrCreateContactByPhone } from '@/utilities/contactIdentity'
import { loadMunicipalityLeadershipSummaries } from '@/utilities/municipality/municipalityViewModels'
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

/**
 * C141 — advisors may only link leaderships to municipalities in their WRITE
 * scope (the Edição axis): `tudo` → any municipality, `carteira` → the
 * administered ones, `somente_leitura` → none. The collection access
 * (`canCreateLeadership`/`canManageLeadership`) already resolves the same
 * axis; this assert keeps the server action's per-municipality check honest
 * (Payload cannot express a per-município constraint on create).
 */
const assertMunicipalitiesWithinScope = async (
  payload: Payload,
  actor: CampaignUser,
  municipalityIDs: number[],
  req?: PayloadTransactionRequest,
) => {
  if (actor.role !== 'advisor') return

  const writable = await getWritableMunicipalityIds(payload, actor, req)
  if (writable === null) return

  const outside = municipalityIDs.filter((id) => !writable.includes(id))
  if (outside.length > 0) {
    throw new Error(LEADERSHIP_MUNICIPALITY_SCOPE_MESSAGE)
  }
}

import { isUniqueLeadershipConflict } from '@/utilities/leadershipConflict'

type LeadershipCreateData = ReturnType<typeof leadershipCreateSchema.parse>
type ValidatedLeadershipCreateData = Omit<LeadershipCreateData, 'phones'> & {
  phones?: string[]
}

const createValidatedLeadershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  data: ValidatedLeadershipCreateData,
) => {
  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await getFreshStaffActor(payload, actor, req)
        await assertMunicipalitiesWithinScope(payload, currentActor, data.municipalities, req)

        let city: string | null = null
        if (data.municipalities.length === 1) {
          const municipality = await payload.findByID({
            collection: 'municipality',
            id: data.municipalities[0]!,
            depth: 0,
            select: { city: true },
            // Intentional admin bypass: staff scope was freshly checked; this
            // read only derives the ficha's default city from the município.
            overrideAccess: true,
            req,
          })
          city = municipality.city
        }

        // Intentional admin bypass: staff scope was freshly checked; the
        // find-or-create atomically maintains the normalized Contact ↔
        // Leadership join (same policy as every phone-backed ficha write).
        const { contactID, reused } = await findOrCreateContactByPhone({
          payload,
          req,
          phones: data.phones ?? [],
          name: data.name,
          email: data.email,
          city: city ?? undefined,
          gender: data.gender,
        })

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
        return { ...leadership, contactReused: reused }
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

export const updateLeadershipContactRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipContactUpdateInput,
) => {
  const data = leadershipContactUpdateSchema.parse(input)

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

      const contactID = relationshipId(current.contact)
      if (contactID === null) {
        throw new Error(LEADERSHIP_INVALID_CONTACT_MESSAGE)
      }

      const contactData: Partial<Pick<Contact, 'name' | 'email'>> & {
        phones?: { value: string }[]
      } = {}

      if (data.field === 'name') {
        contactData.name = data.name
      } else if (data.field === 'email') {
        contactData.email = data.email ?? null
      } else if (data.field === 'phone') {
        // Inline cell edit = set the PRIMARY phone, keeping the rest of the
        // list untouched: the new number goes first (an earlier occurrence
        // moves, never duplicates) and clearing removes the primary.
        const contact = current.contact
        contactData.phones = reorderWithPrimaryPhone(
          typeof contact === 'object' && contact !== null ? contact.phones : null,
          data.phone,
        ).map((value) => ({ value }))
      } else if (data.field === 'phones') {
        contactData.phones = data.phones.map((value) => ({ value }))
      }

      // bypass: contact write is staff-scoped via leadership access check above.
      await payload.update({
        collection: 'contact',
        id: contactID,
        data: contactData,
        depth: 0,
        overrideAccess: true,
        req,
      })

      return current
    },
    { beginFailureMessage: 'Não foi possível atualizar o contato da liderança.' },
  )
}

export const updateLeadershipContact = async (input: LeadershipContactUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const leadership = await updateLeadershipContactRecord(payload, actor, input)
  revalidatePath(`/campanha/liderancas/${leadership.id}`, 'page')
  return leadership
}

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

      // bypass: contact write is staff-scoped via leadership access check above.
      await payload.update({
        collection: 'contact',
        id: contactID,
        data: {
          name: data.name,
          phones: data.phones.map((value) => ({ value })),
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
    phones: data.phones,
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
 * B155 — inline create from the "Lideranças" column of `/campanha/municipios`.
 * Name-only municipality-surface entry point over the transactional create.
 * The list we are ON is deliberately not
 * revalidated — the chip already shows optimistically (B34 contract); the
 * leadership list and the município detail are, so the new row appears there
 * without waiting for a refresh.
 */
export const createMunicipalityLeadershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityLeadershipCreateInput,
) => {
  const data = municipalityLeadershipCreateSchema.parse(input)
  const leadership = await createValidatedLeadershipRecord(payload, actor, {
    name: data.name,
    phones: [],
    municipalities: [data.municipalityId],
    email: undefined,
    exclusive: true,
    supportStatus: 'a_abordar',
    notes: undefined,
  })

  const { leadershipIDsByMunicipality, summariesById } = await loadMunicipalityLeadershipSummaries(
    payload,
    actor,
    [data.municipalityId],
  )
  return {
    leadership,
    leadershipIDs: leadershipIDsByMunicipality.get(data.municipalityId) ?? [],
    createdLeadershipName: summariesById.get(leadership.id)?.name ?? data.name,
  }
}

export const createMunicipalityLeadership = async (input: MunicipalityLeadershipCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const result = await createMunicipalityLeadershipRecord(payload, actor, input)

  // Intentional admin bypass: existence is enforced by the write's own
  // relationship validation; this read only resolves the revalidate target.
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: input.municipalityId,
    depth: 0,
    select: { slug: true },
    overrideAccess: true,
  })
  revalidateLeadershipWizardPaths(result.leadership.id, municipality.slug)
  return result
}

/**
 * B155 — one-chip toggle from the "Lideranças" column of `/campanha/municipios`:
 * the same B34 membership delta (lock, scope-check, floor/cap) keyed by the
 * município side, plus the resulting municipality-side id set. The list we are
 * on is skipped (optimistic chip); the leadership ficha, the município detail
 * AND `/campanha/liderancas` are busted — unlike B34, the caller is NOT on that
 * list, so its stale router cache must not survive.
 */
export const setMunicipalityLeadershipMembership = async (input: {
  municipalityId: number
  leadershipId: number
  assigned: boolean
}) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, municipalitySlugs } = await setLeadershipMunicipalitiesMembershipRecord(
    payload,
    actor,
    {
      leadershipId: input.leadershipId,
      municipalityIds: [input.municipalityId],
      assigned: input.assigned,
    },
  )

  // No-op writes nothing, so there is nothing to revalidate.
  if (municipalitySlugs.length > 0) {
    revalidateLeadershipMunicipalityPaths(input.leadershipId, municipalitySlugs)
    revalidatePath('/campanha/liderancas', 'page')
  }

  const { leadershipIDsByMunicipality } = await loadMunicipalityLeadershipSummaries(
    payload,
    actor,
    [input.municipalityId],
  )
  return {
    leadership,
    leadershipIDs: leadershipIDsByMunicipality.get(input.municipalityId) ?? [],
  }
}

/**
 * `/campanha/liderancas` — the list the chip was toggled ON — is deliberately
 * NOT here: see `revalidateLeadershipMunicipalityPaths` below for the reason.
 */
const revalidateLeadershipStateDeputyPaths = (leadershipId: number, stateDeputyID?: number) => {
  revalidatePath(`/campanha/liderancas/${leadershipId}`, 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
  if (stateDeputyID) {
    revalidatePath(`/campanha/dobradinhas/${stateDeputyID}`, 'page')
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
 * delta shape, the scope assertion, the return — is genuinely
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
) => {
  const { leadershipId, stateDeputyId, assigned } =
    leadershipStateDeputyMembershipSchema.parse(input)

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

      const currentStateDeputyIDs = uniqueRelationshipIds(current.stateDeputies)
      const nextStateDeputyIDs = nextStateDeputyIdsAfterMembership(
        currentStateDeputyIDs,
        stateDeputyId,
        assigned,
      )

      // No-op: nothing to write, and nothing for the caller to revalidate.
      if (nextStateDeputyIDs === null) {
        return { leadership: current, stateDeputyID: undefined }
      }

      const updated = await payload.update({
        collection: 'leadership',
        id: leadershipId,
        data: { stateDeputies: nextStateDeputyIDs },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      return { leadership: updated, stateDeputyID: stateDeputyId }
    },
    { beginFailureMessage: 'Não foi possível atualizar as dobradinhas.' },
  )
}

export const setLeadershipStateDeputyMembership = async (
  input: LeadershipStateDeputyMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadership, stateDeputyID } = await setLeadershipStateDeputyMembershipRecord(
    payload,
    actor,
    input,
  )
  // No-op writes nothing, so there is nothing to revalidate.
  if (stateDeputyID) revalidateLeadershipStateDeputyPaths(input.leadershipId, stateDeputyID)
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
 * C128 — the B34 municipalities delta core, transaction-agnostic: given the
 * leadership's CURRENT municipalities (read under the caller's advisory lock),
 * computes the membership change, scope-checks the added ids and writes it.
 * Shared by the `/campanha/liderancas` chip cell (B34) and the person
 * lifecycle (`setPersonLeadershipMunicipalitiesRecord`) so the two surfaces
 * can never disagree on the delta contract.
 */
export const applyLeadershipMunicipalitiesDelta = async (
  payload: Payload,
  currentActor: CampaignUser,
  req: PayloadTransactionRequest,
  leadershipId: number,
  currentMunicipalityIDs: readonly number[],
  municipalityIds: readonly number[],
  assigned: boolean,
): Promise<{ leadership: Leadership | null; slugs: string[] }> => {
  const change = nextMunicipalityIdsAfterLeadershipMembership(
    currentMunicipalityIDs,
    municipalityIds,
    assigned,
  )

  // No-op: nothing to write, and nothing for the caller to revalidate.
  if (change === null) {
    return { leadership: null, slugs: [] }
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

  return { leadership: updated, slugs: touched.docs.map((doc) => doc.slug) }
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
      const { currentActor, current } = await openLeadershipForRelationDelta(
        payload,
        actor,
        req,
        leadershipId,
        'municipalities',
      )

      const delta = await applyLeadershipMunicipalitiesDelta(
        payload,
        currentActor,
        req,
        leadershipId,
        uniqueRelationshipIds(current.municipalities),
        municipalityIds,
        assigned,
      )

      return {
        leadership: delta.leadership ?? current,
        municipalitySlugs: delta.slugs,
      }
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

/**
 * C99 — one chip toggle on `Leadership.advisors` ("Assessores responsáveis").
 * Unrestricted staff only (coordinator/candidate), mirror of
 * `setStateDeputyAdvisorMembershipRecord`: the read and write run under
 * `overrideAccess` because the `advisors` field's update access is admin-only
 * in the collection config; the fresh unrestricted actor exists solely to make
 * the gate assertion, and the `beforeValidate` eligibility hook still runs
 * under the bypass.
 */
export const setLeadershipAdvisorMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: LeadershipAdvisorMembershipInput,
) => {
  const { leadershipId, advisorId, assigned } = leadershipAdvisorMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      await reloadUnrestrictedActor(payload, actor, LEADERSHIP_ADVISORS_UNRESTRICTED_MESSAGE, req)

      await acquireTextAdvisoryLocks(payload, req, [`leadership-advisors:${leadershipId}`])

      const leadership = await payload.findByID({
        collection: 'leadership',
        id: leadershipId,
        depth: 0,
        select: { advisors: true },
        // Intentional admin bypass: the unrestricted role was verified above;
        // the `advisors` field's update access is admin-only in the collection
        // config (same contract as the dobradinha twin). The `beforeValidate`
        // eligibility hook still runs under the bypass.
        overrideAccess: true,
        req,
      })

      const currentAdvisorIDs = uniqueRelationshipIds(leadership.advisors)
      const nextAdvisorIDs = nextLeadershipAdvisorIdsAfterMembership(
        currentAdvisorIDs,
        advisorId,
        assigned,
      )

      // No-op: nothing to write, and nothing for the caller to revalidate.
      if (nextAdvisorIDs === null) {
        return { leadershipID: undefined }
      }

      await payload.update({
        collection: 'leadership',
        id: leadershipId,
        data: { advisors: nextAdvisorIDs },
        depth: 0,
        // Same intentional bypass as the read: the unrestricted role was
        // verified above, and the eligibility hook still runs under it.
        overrideAccess: true,
        req,
      })

      return { leadershipID: leadershipId }
    },
    { beginFailureMessage: 'Não foi possível atualizar os assessores da liderança.' },
  )
}

export const setLeadershipAdvisorMembership = async (input: LeadershipAdvisorMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadershipID } = await setLeadershipAdvisorMembershipRecord(payload, actor, input)
  // The detail page is the only surface of this relation (C99) — same targeted
  // revalidate contract as the dobradinha twin.
  if (leadershipID) revalidatePath(`/campanha/liderancas/${leadershipID}`, 'page')
  return leadershipID
}
