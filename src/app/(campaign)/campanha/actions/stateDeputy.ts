'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import { contactFieldUpdateSchema, type ContactFieldUpdateInput } from '@/lib/schemas/contact'
import {
  STATE_DEPUTY_ADVISORS_UNRESTRICTED_MESSAGE,
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_INVALID_CONTACT_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
  municipalityStateDeputyCreateSchema,
  stateDeputyAdvisorMembershipSchema,
  stateDeputyCreateSchema,
  stateDeputyMunicipalitiesBatchSchema,
  stateDeputyPartyUpdateSchema,
  stateDeputyUpdateSchema,
  type MunicipalityStateDeputyCreateInput,
  type StateDeputyAdvisorMembershipInput,
  type StateDeputyCreateInput,
  type StateDeputyMunicipalitiesBatchInput,
  type StateDeputyPartyUpdateInput,
  type StateDeputyUpdateInput,
} from '@/lib/schemas/stateDeputy'
import { nextStateDeputyAdvisorIdsAfterMembership } from '@/lib/stateDeputyAdvisorMembership'
import type { CampaignUser, Contact } from '@/payload-types'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import {
  mapStaffEntityConflict,
  runStaffEntityMutation,
  type StaffEntityPolicy,
} from '@/utilities/campaignEntityActions'
import { assertContactPhoneWritable } from '@/utilities/contactPhoneInvariant'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { assertStateDeputyNameAvailable } from '@/utilities/stateDeputy/nameInvariant'

const stateDeputyPolicy: StaffEntityPolicy = {
  staffMessage: STATE_DEPUTY_STAFF_MESSAGE,
  conflictPattern: /state_deputy_(contact|slug)|duplicate key/i,
  conflictMessage: STATE_DEPUTY_CONFLICT_MESSAGE,
}

type StateDeputyCreationData = {
  name: string
  party?: string | null
  notes?: string | null
}

const createStateDeputyWithContact = async (
  payload: Payload,
  actor: CampaignUser,
  data: StateDeputyCreationData,
  req: { transactionID: number | string },
) => {
  // Intentional admin bypass: Contact is admin-managed, while this staff action
  // owns the atomic Contact ↔ StateDeputy creation.
  await assertStateDeputyNameAvailable(payload, req, data.name)

  const contact = await payload.create({
    collection: 'contact',
    data: {
      name: data.name,
      email: null,
      phone: null,
      state: 'BA' as Contact['state'],
      city: null,
    },
    depth: 0,
    // Intentional admin bypass: this Contact write is owned by the atomic staff action.
    overrideAccess: true,
    req,
  })

  return payload.create({
    collection: 'stateDeputy',
    data: hookFilledCreateData<'stateDeputy'>({
      contact: contact.id,
      ...(data.party === undefined ? {} : { party: data.party }),
      ...(data.notes === undefined ? {} : { notes: data.notes }),
    }),
    depth: 0,
    user: actor,
    overrideAccess: false,
    req,
  })
}

const createStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyCreateInput,
) => {
  const data = stateDeputyCreateSchema.parse(input)
  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await reloadStaffActor(payload, actor, STATE_DEPUTY_STAFF_MESSAGE, req)
        return createStateDeputyWithContact(payload, currentActor, data, req)
      },
      { beginFailureMessage: 'Não foi possível iniciar a transação da dobradinha.' },
    )
  } catch (error) {
    const conflict = mapStaffEntityConflict(error, stateDeputyPolicy)
    if (conflict) throw conflict
    throw error
  }
}

const updateStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyUpdateInput,
) => {
  const { id, ...data } = stateDeputyUpdateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, stateDeputyPolicy, (currentActor) =>
    payload.update({
      collection: 'stateDeputy',
      id,
      data,
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

export const updateStateDeputyPartyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyPartyUpdateInput,
) => {
  const { id, party } = stateDeputyPartyUpdateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, stateDeputyPolicy, (currentActor) =>
    payload.update({
      collection: 'stateDeputy',
      id,
      data: { party },
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

export const updateStateDeputyContactRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ContactFieldUpdateInput,
) => {
  const data = contactFieldUpdateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, STATE_DEPUTY_STAFF_MESSAGE, req)
      const current = await payload.findByID({
        collection: 'stateDeputy',
        id: data.id,
        depth: 0,
        select: { contact: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const contactID = relationshipId(current.contact)
      if (contactID === null) throw new Error(STATE_DEPUTY_INVALID_CONTACT_MESSAGE)

      const contactData: Partial<Pick<Contact, 'name' | 'phone' | 'email'>> = {}
      if (data.field === 'name') {
        await assertStateDeputyNameAvailable(payload, req, data.name, data.id)
        contactData.name = data.name
      } else if (data.field === 'email') {
        contactData.email = data.email ?? null
      } else if (data.field === 'phone') {
        if (data.phone) {
          await assertContactPhoneWritable(payload, req, contactID, data.phone)
          contactData.phone = data.phone
        } else {
          contactData.phone = null
        }
      }

      // Bypass: the StateDeputy row access above established staff scope.
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
    { beginFailureMessage: 'Não foi possível atualizar o contato da dobradinha.' },
  )
}

export const createStateDeputy = async (input: StateDeputyCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createStateDeputyRecord(payload, actor, input)
}

const revalidateStateDeputyPaths = (stateDeputyID: number) => {
  revalidatePath('/campanha/dobradinhas', 'page')
  revalidatePath(`/campanha/dobradinhas/${stateDeputyID}`, 'page')
  revalidatePath('/campanha/liderancas', 'page')
  revalidatePath('/campanha/liderancas/[id]', 'page')
  revalidateMunicipalityListPaths({ scope: 'both' })
}

export const updateStateDeputy = async (input: StateDeputyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const updated = await updateStateDeputyRecord(payload, actor, input)
  revalidateStateDeputyPaths(updated.id)
  return updated
}

export const updateStateDeputyParty = async (input: StateDeputyPartyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const updated = await updateStateDeputyPartyRecord(payload, actor, input)
  revalidateStateDeputyPaths(updated.id)
  return updated
}

export const updateStateDeputyContact = async (input: ContactFieldUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const updated = await updateStateDeputyContactRecord(payload, actor, input)
  revalidateStateDeputyPaths(updated.id)
  return updated
}

/**
 * `/campanha/dobradinhas` — the list this chip cell lives on since B37 — is
 * deliberately absent, on the same reasoning as the leadership twin: the cell
 * already shows the toggle, so refreshing its own list re-serializes the table
 * and the município index for a change already on screen.
 */
const revalidateStateDeputyMunicipalityPaths = (
  stateDeputyID: number | undefined,
  municipalitySlugs: readonly string[],
) => {
  if (stateDeputyID) {
    revalidatePath(`/campanha/dobradinhas/${stateDeputyID}`, 'page')
  }
  revalidateMunicipalityListPaths({ scope: 'list' })
  for (const slug of municipalitySlugs) {
    revalidateMunicipalityListPaths({ slug, scope: 'detail' })
  }
}

/**
 * Delta write for the "Municípios" column of `/campanha/dobradinhas` (B37) —
 * adds or removes this `stateDeputy` on `municipality.stateDeputies` for a
 * batch of municipalities (one chip, or a whole território/ZE). Mirrors
 * `setAdvisorMunicipalitiesBatchRecord`: many municípios get touched, not one
 * owning document. Unlike that twin, this write does NOT bypass access —
 * `canUpdateMunicipality` already scopes an advisor to administered
 * municípios at the document level, and `stateDeputies`' field access
 * (`canManageCampaignStaffField`) is staff-wide, so `overrideAccess: false`
 * on both the read and the write is what refuses an out-of-scope município.
 */
export const setStateDeputyAdvisorMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyAdvisorMembershipInput,
) => {
  const { stateDeputyId, advisorId, assigned } = stateDeputyAdvisorMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      // Role gate only — the read/write below run under overrideAccess (the
      // `advisors` field's update access is admin-only in the collection
      // config), so the fresh actor exists solely to make the assertion.
      await reloadUnrestrictedActor(payload, actor, STATE_DEPUTY_ADVISORS_UNRESTRICTED_MESSAGE, req)

      await acquireTextAdvisoryLocks(payload, req, [`state-deputy-advisors:${stateDeputyId}`])

      const stateDeputy = await payload.findByID({
        collection: 'stateDeputy',
        id: stateDeputyId,
        depth: 0,
        select: { advisors: true },
        // Intentional admin bypass: the unrestricted role was verified above;
        // the `advisors` field's update access is admin-only in the collection
        // config, same contract as `setAdvisorMunicipalitiesBatchRecord`. The
        // `beforeValidate` eligibility hook still runs under overrideAccess.
        overrideAccess: true,
        req,
      })

      const currentAdvisorIDs = uniqueRelationshipIds(stateDeputy.advisors)
      const nextAdvisorIDs = nextStateDeputyAdvisorIdsAfterMembership(
        currentAdvisorIDs,
        advisorId,
        assigned,
      )

      // No-op: nothing to write, and nothing for the caller to revalidate.
      if (nextAdvisorIDs === null) {
        return { stateDeputyID: undefined }
      }

      // Same intentional bypass as the read: the unrestricted role was verified
      // above, and the `beforeValidate` eligibility hook still runs under it.
      await payload.update({
        collection: 'stateDeputy',
        id: stateDeputyId,
        data: { advisors: nextAdvisorIDs },
        depth: 0,
        overrideAccess: true,
        req,
      })

      return { stateDeputyID: stateDeputyId }
    },
    { beginFailureMessage: 'Não foi possível atualizar os assessores da dobradinha.' },
  )
}

export const setStateDeputyAdvisorMembership = async (input: StateDeputyAdvisorMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const { stateDeputyID } = await setStateDeputyAdvisorMembershipRecord(payload, actor, input)
  // The list is deliberately absent: the chip cell that calls this IS on it and
  // already shows the toggle. The detail page is the route an actor cannot see
  // from here — same reasoning as the leadership twin (B31).
  if (stateDeputyID) revalidatePath(`/campanha/dobradinhas/${stateDeputyID}`, 'page')
  return stateDeputyID
}

export const setStateDeputyMunicipalitiesBatchRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyMunicipalitiesBatchInput,
) => {
  const { stateDeputyId, municipalityIds, assigned } =
    stateDeputyMunicipalitiesBatchSchema.parse(input)
  // Already deduped by the schema's `.transform`; sorted only so a batch applies
  // and reports in a stable order — `acquireTextAdvisoryLocks` sorts its own keys,
  // so the deadlock-avoidance ordering does not depend on this line.
  const uniqueMunicipalityIds = [...municipalityIds].sort((left, right) => left - right)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, STATE_DEPUTY_STAFF_MESSAGE, req)

      await acquireTextAdvisoryLocks(
        payload,
        req,
        uniqueMunicipalityIds.map((id) => `municipality-state-deputies:${id}`),
      )

      // Every município actually changed, not just the last one — same bug
      // class the B34 twin fixed: a território chip can touch up to 435
      // municípios in one call, and revalidating only the last would leave
      // the rest of the detail pages stale.
      const changedSlugs: string[] = []

      for (const municipalityId of uniqueMunicipalityIds) {
        // Row + field access verify the município is in the actor's scope
        // (`canUpdateMunicipality` for advisors, `canManageCampaignStaffField`
        // for the field) — an out-of-scope município throws here.
        const municipality = await payload.findByID({
          collection: 'municipality',
          id: municipalityId,
          depth: 0,
          select: { stateDeputies: true, slug: true },
          user: currentActor,
          overrideAccess: false,
          req,
        })

        const currentStateDeputyIDs = uniqueRelationshipIds(municipality.stateDeputies)
        const nextStateDeputyIDs = nextStateDeputyIdsAfterMunicipalityMembership(
          currentStateDeputyIDs,
          stateDeputyId,
          assigned,
        )
        if (nextStateDeputyIDs === null) continue

        await payload.update({
          collection: 'municipality',
          id: municipalityId,
          data: { stateDeputies: nextStateDeputyIDs },
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
        if (typeof municipality.slug === 'string') changedSlugs.push(municipality.slug)
      }

      return {
        stateDeputyID: changedSlugs.length > 0 ? stateDeputyId : undefined,
        slugs: changedSlugs,
      }
    },
    { beginFailureMessage: 'Não foi possível atualizar os municípios da dobradinha.' },
  )
}

export const setStateDeputyMunicipalitiesBatch = async (
  input: StateDeputyMunicipalitiesBatchInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const result = await setStateDeputyMunicipalitiesBatchRecord(payload, actor, input)
  if (result.slugs.length > 0) {
    revalidateStateDeputyMunicipalityPaths(result.stateDeputyID, result.slugs)
  }
  return result
}

/**
 * B157 — name-only (+ party via `Nome (PARTIDO)`) inline create from the
 * "Dobradinhas" column of `/campanha/municipios`. Creates the `stateDeputy`
 * and assigns it to the município in the SAME transaction: if the assign
 * fails (out-of-scope município, cap), the create rolls back with it — no
 * orphan, same contract as `createMunicipalityAdvisorRecord` (B154). The
 * unique `slug` violation is mapped to the safe conflict message; the
 * município write re-checks `canUpdateMunicipality` through the same
 * `user`-threaded read as the B37 batch.
 */
export const createMunicipalityStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityStateDeputyCreateInput,
) => {
  const { municipalityId, name, party } = municipalityStateDeputyCreateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, STATE_DEPUTY_STAFF_MESSAGE, req)

      await acquireTextAdvisoryLocks(payload, req, [
        `municipality-state-deputies:${municipalityId}`,
      ])

      let created
      try {
        created = await createStateDeputyWithContact(payload, currentActor, { name, party }, req)
      } catch (error) {
        // Same translation as the shared owner (`runStaffEntityMutation`): the
        // pattern covers the insert race, `ValidationError` covers Payload's
        // pre-insert unique check — in this create path the only validation
        // left after zod IS the unique slug check.
        const conflict = mapStaffEntityConflict(error, stateDeputyPolicy)
        if (conflict) throw conflict
        throw error
      }

      const municipality = await payload.findByID({
        collection: 'municipality',
        id: municipalityId,
        depth: 0,
        select: { stateDeputies: true, slug: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const nextStateDeputyIDs = nextStateDeputyIdsAfterMunicipalityMembership(
        uniqueRelationshipIds(municipality.stateDeputies),
        created.id,
        true,
      )
      // Unreachable — the created id cannot already be assigned — but mirrors
      // the B154 twin's no-write return so the null branch is honest.
      if (nextStateDeputyIDs !== null) {
        await payload.update({
          collection: 'municipality',
          id: municipalityId,
          data: { stateDeputies: nextStateDeputyIDs },
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return {
        stateDeputy: {
          id: created.id,
          name,
          slug: created.slug,
          party: created.party ?? null,
        },
        municipalitySlug: typeof municipality.slug === 'string' ? municipality.slug : undefined,
      }
    },
    { beginFailureMessage: 'Não foi possível iniciar a criação da dobradinha.' },
  )
}

export const createMunicipalityStateDeputy = async (input: MunicipalityStateDeputyCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const result = await createMunicipalityStateDeputyRecord(payload, actor, input)
  if (result.municipalitySlug) {
    revalidateStateDeputyMunicipalityPaths(result.stateDeputy.id, [result.municipalitySlug])
  }
  return result
}

export type MunicipalityStateDeputyCreateResult = Awaited<
  ReturnType<typeof createMunicipalityStateDeputyRecord>
>
