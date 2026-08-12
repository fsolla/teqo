'use server'

import { randomBytes } from 'crypto'

import { revalidatePath } from 'next/cache'

import { applyLeadershipMunicipalitiesDelta } from '@/app/(campaign)/campanha/actions/leadership'
import { toggleMunicipalityAdvisorMembership } from '@/app/(campaign)/campanha/actions/municipality'
import { applyStateDeputyMunicipalitiesBatch } from '@/app/(campaign)/campanha/actions/stateDeputy'
import { nextLeadershipAdvisorIdsAfterMembership } from '@/lib/leadershipAdvisorMembership'
import { reorderWithPrimaryPhone } from '@/lib/phone'
import { uniqueRelationshipIds } from '@/lib/relationship'
import { contactFieldUpdateSchema, type ContactFieldUpdateInput } from '@/lib/schemas/contact'
import {
  LEADERSHIP_DUPLICATE_MESSAGE,
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  MAX_LEADERSHIP_MUNICIPALITIES,
} from '@/lib/schemas/leadership'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
  personAdvisorMembershipSchema,
  personAssessoraMembershipSchema,
  personCapacityExitSchema,
  personLeadershipMembershipSchema,
  personStateDeputyMembershipSchema,
  type PersonAdvisorMembershipInput,
  type PersonAssessoraMembershipInput,
  type PersonLeadershipMembershipInput,
  type PersonStateDeputyMembershipInput,
} from '@/lib/schemas/personCell'
import {
  PERSON_DELETE_FORBIDDEN_MESSAGE,
  personDeleteInputSchema,
} from '@/lib/schemas/personDelete'
import { nextStateDeputyAdvisorIdsAfterMembership } from '@/lib/stateDeputyAdvisorMembership'
import type { CampaignUser, Contact, Leadership, StateDeputy } from '@/payload-types'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import { mapStaffEntityConflict } from '@/utilities/campaignEntityActions'
import { nextFreeStubCampaignEmail } from '@/utilities/campaignStubEmail'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { isUniqueLeadershipConflict } from '@/utilities/leadershipConflict'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import {
  assertPersonCapacityExitScope,
  loadPersonCapacityExitManifest,
} from '@/utilities/people/personCapacityExit'
import {
  deleteCampaignUserAccount,
  deletePersonRecord,
  loadPersonDeleteManifest,
} from '@/utilities/people/personDelete'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { assertStateDeputyNameAvailable } from '@/utilities/stateDeputy/nameInvariant'
import { stateDeputyPolicy } from '@/utilities/stateDeputyConflict'
import { municipalityIdsByStateDeputyIds } from '@/utilities/stateDeputyData'
import type { Payload } from 'payload'

/** C128 — slugs of the touched municipalities, for targeted revalidation. */
const municipalitySlugsOf = async (
  payload: Payload,
  req: PayloadTransactionRequest,
  municipalityIDs: readonly number[],
): Promise<string[]> => {
  if (municipalityIDs.length === 0) return []
  const touched = await payload.find({
    collection: 'municipality',
    where: { id: { in: [...municipalityIDs] } },
    depth: 0,
    pagination: false,
    select: { slug: true },
    // Intentional admin bypass: only resolves slugs for revalidation; the
    // caller's scope check authorizes the write this read serves.
    overrideAccess: true,
    req,
  })
  return touched.docs.map((doc) => doc.slug)
}

/**
 * C100 "Apagar pessoa" server actions. Both are coordinator/candidate-only
 * (`reloadUnrestrictedActor`): the cascade is transversal, wider than any
 * advisor carteira.
 */

/** The confirmation dialog lists this verbatim before offering the destroy. */
export const getPersonDeleteManifestAction = async (input: unknown) => {
  const data = personDeleteInputSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  await reloadUnrestrictedActor(payload, actor, PERSON_DELETE_FORBIDDEN_MESSAGE)
  return loadPersonDeleteManifest(payload, data.contactId)
}

export const deletePersonAction = async (input: unknown) => {
  const data = personDeleteInputSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  const currentActor = await reloadUnrestrictedActor(
    payload,
    actor,
    PERSON_DELETE_FORBIDDEN_MESSAGE,
  )
  return deletePersonRecord(payload, currentActor, data.contactId)
}

// ---------------------------------------------------------------------------
// C116 — "edit where you see": per-cell writes of the people list table.
// ---------------------------------------------------------------------------

/**
 * C116 — the cell-edit scope rule for a person's ficha fields: unrestricted
 * actors always pass; an advisor passes only when at least ONE entity of the
 * person (leadership or dobradinha) is readable with his own access — the "you
 * edit what you see" rule, mirroring the row's visibility (a staff-only person
 * is not entity-manageable and therefore not editable by an advisor).
 */
const assertPersonContactEditable = async (
  payload: Payload,
  actor: CampaignUser,
  contactID: number,
  req: { transactionID: number | string },
): Promise<void> => {
  if (isCampaignUnrestricted(actor)) return

  const [leaderships, deputies] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      user: actor,
      overrideAccess: false,
      req,
    }),
    payload.find({
      collection: 'stateDeputy',
      where: { contact: { equals: contactID } },
      depth: 0,
      limit: 1,
      pagination: false,
      user: actor,
      overrideAccess: false,
      req,
    }),
  ])

  if (leaderships.docs.length === 0 && deputies.docs.length === 0) {
    throw new Error(PERSON_CELL_NOT_IN_SCOPE_MESSAGE)
  }
}

export const updatePersonContactRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ContactFieldUpdateInput,
) => {
  const data = contactFieldUpdateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, PERSON_CELL_STAFF_MESSAGE, req)

      await assertPersonContactEditable(payload, currentActor, data.id, req)

      const contactData: Partial<Pick<Contact, 'name' | 'email' | 'city'>> & {
        phones?: { value: string }[]
      } = {}
      if (data.field === 'name') {
        contactData.name = data.name
      } else if (data.field === 'email') {
        contactData.email = data.email ?? null
      } else if (data.field === 'phone') {
        // Inline cell edit = set the PRIMARY phone, keeping the rest of the
        // list untouched (C112 shape — same contract as the leadership and
        // dobradinha siblings): the new number goes first, clearing removes
        // the primary and the rest shifts up.
        const current = await payload.findByID({
          collection: 'contact',
          id: data.id,
          depth: 0,
          select: { phones: true },
          // Intentional bypass: the scope check above established the actor's
          // right over the person's ficha; this read only resolves the current
          // primary-phone list to reorder.
          overrideAccess: true,
          req,
        })
        contactData.phones = reorderWithPrimaryPhone(current.phones, data.phone).map((value) => ({
          value,
        }))
      } else if (data.field === 'city') {
        contactData.city = data.city
      }

      // Bypass: the scope check above established the actor's right over the
      // person's ficha (same precedent as the leadership/dobradinha cell edits).
      await payload.update({
        collection: 'contact',
        id: data.id,
        data: contactData,
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a edição da pessoa.' },
  )
}

export const updatePersonContact = async (input: ContactFieldUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  await updatePersonContactRecord(payload, actor, input)
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/liderancas', 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
}

/**
 * C116/C128 — the Assessora column of a person: toggles the person's staff
 * account on `municipality.advisors` for a batch of municipalities (one
 * territory / ZE chip or a "Salvador (19)" group), in ONE transaction.
 * Unrestricted-only (`canAssignMunicipalityAdvisors`).
 *
 * C128 lifecycle: with NO account, adding the first municipality CREATES the
 * staff account (role `advisor`, linked to the person's ficha, random
 * unshared password — no usable e-mail/username, login is provisioned later);
 * removing the LAST municipality deletes the account (the destructive exit,
 * confirmed by the dialog that listed the manifest). With more than one
 * account, "which account" is ambiguous, so the server refuses with a safe
 * message (the cell renders read-only for those rows).
 */
export const setPersonAssessoraMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PersonAssessoraMembershipInput,
) => {
  const { contactId, municipalityIds, assigned } = personAssessoraMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      await reloadUnrestrictedActor(payload, actor, PERSON_ASSESSORA_UNRESTRICTED_MESSAGE, req)

      const accounts = await payload.find({
        collection: 'campaignUser',
        where: { contact: { equals: contactId } },
        depth: 0,
        limit: 2,
        pagination: false,
        // Intentional bypass: the unrestricted gate above is the authorization;
        // `contact` is identity-gated and the accounts are only counted.
        overrideAccess: true,
        req,
      })

      if (accounts.docs.length > 1) throw new Error(PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE)

      let accountId: number
      if (accounts.docs.length === 1) {
        accountId = Number(accounts.docs[0].id)
      } else if (assigned) {
        // C128 — the first municipality creates the account. The explicit
        // `contact` (justified bypass) keeps the C99 `resolveContactForAccount`
        // hook from minting an orphan ficha when the person has no phone; the
        // random password is never shared, so the account cannot log in until
        // a coordinator provisions credentials (same contract as B154).
        const contact = await payload.findByID({
          collection: 'contact',
          id: contactId,
          depth: 0,
          select: { name: true },
          // Intentional bypass: the unrestricted gate above is the
          // authorization; this read only resolves the account name.
          overrideAccess: true,
          req,
        })
        const email = await nextFreeStubCampaignEmail(payload, req, contact.name ?? 'Contato')
        const created = await payload.create({
          collection: 'campaignUser',
          data: hookFilledCreateData<'campaignUser'>({
            name: contact.name ?? 'Contato',
            role: 'advisor',
            contact: contactId,
            // `@criado.invalid` placeholder — no usable e-mail (never receives
            // mail, cannot reset the password with it); the random password is
            // never shared, so the account cannot log in until a coordinator
            // provisions credentials (same contract as B154).
            email,
            password: randomBytes(24).toString('base64url'),
          }),
          depth: 0,
          // Intentional bypass: the unrestricted gate above is the
          // authorization; the `contact` field is system-gated and the C99
          // identity hooks would otherwise diverge from the explicit ficha.
          overrideAccess: true,
          req,
        })
        accountId = created.id
      } else {
        // Removal on a person with no account: nothing to remove.
        return { accountId: null, slugs: [] }
      }

      // Before toggling, decide the destructive exit: a removal that would
      // empty the carteira deletes the account (with its authored rows and
      // assessorado links) — the confirmation dialog listed the manifest.
      if (!assigned) {
        const current = await payload.find({
          collection: 'municipality',
          where: { advisors: { contains: accountId } },
          depth: 0,
          limit: 0,
          pagination: false,
          // Intentional bypass: the unrestricted gate above is the
          // authorization; this read only enumerates the current carteira
          // (docs always carry their id).
          overrideAccess: true,
          req,
        })
        const currentMunicipalityIDs = current.docs.map((doc) => doc.id)
        const next = currentMunicipalityIDs.filter((id) => !municipalityIds.includes(id))
        if (next.length === 0) {
          const slugs = await municipalitySlugsOf(payload, req, currentMunicipalityIDs)
          await deleteCampaignUserAccount(payload, req, accountId)
          return { accountId: null, slugs }
        }
      }

      for (const municipalityId of municipalityIds) {
        await toggleMunicipalityAdvisorMembership(payload, req, municipalityId, accountId, assigned)
      }

      const slugs = await municipalitySlugsOf(payload, req, municipalityIds)
      return { accountId, slugs }
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização da carteira.' },
  )
}

export const setPersonAssessoraMembership = async (input: PersonAssessoraMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const { accountId, slugs } = await setPersonAssessoraMembershipRecord(payload, actor, input)
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/assessores', 'page')
  if (accountId !== null) revalidatePath(`/campanha/assessores/${accountId}`, 'page')
  for (const slug of slugs) revalidatePath(`/campanha/municipios/${slug}`, 'page')
  revalidateMunicipalityListPaths({ scope: 'list' })
}

/**
 * C128 — the Lidera column of a person: person-centric lifecycle write. The
 * first added municipality CREATES the leadership (contact + municipalities,
 * under `canCreateLeadership` — an advisor may only create within his
 * carteira); removing the last municipality DELETES the leadership with its
 * vote pledges and invites (destructive exit, scope-guarded: an advisor needs
 * EVERY current municipality in his carteira, and the confirmation dialog
 * listed the manifest). The cap/floor contracts of the leadership collection
 * stay enforced — the exit goes straight to the delete, never an empty
 * update (`requireAtLeastOneMunicipality` would reject it).
 */
export const setPersonLeadershipMunicipalitiesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PersonLeadershipMembershipInput,
) => {
  const { contactId, municipalityIds, assigned } = personLeadershipMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, PERSON_CELL_STAFF_MESSAGE, req)

      const leaderships = await payload.find({
        collection: 'leadership',
        where: { contact: { equals: contactId } },
        depth: 0,
        limit: 1,
        pagination: false,
        select: { id: true, municipalities: true },
        user: currentActor,
        overrideAccess: false,
      })
      const leadership = leaderships.docs[0] as Leadership | undefined

      if (!leadership) {
        if (!assigned) return { leadershipID: null, slugs: [] }
        if (municipalityIds.length > MAX_LEADERSHIP_MUNICIPALITIES) {
          throw new Error(LEADERSHIP_MUNICIPALITY_CAP_MESSAGE)
        }
        try {
          // `canCreateLeadership` re-checks the advisor's carteira through the
          // user-threaded create (every requested município must be in scope).
          const created = await payload.create({
            collection: 'leadership',
            data: hookFilledCreateData<'leadership'>({
              contact: contactId,
              municipalities: municipalityIds,
            }),
            depth: 0,
            user: currentActor,
            overrideAccess: false,
            req,
          })
          const slugs = await municipalitySlugsOf(payload, req, municipalityIds)
          return { leadershipID: created.id, slugs }
        } catch (error) {
          if (isUniqueLeadershipConflict(error)) {
            throw new Error(LEADERSHIP_DUPLICATE_MESSAGE)
          }
          throw error
        }
      }

      // The advisory lock guards the delta read AND the exit enumeration —
      // same key the B34 chip cell holds for the same relation.
      await acquireTextAdvisoryLocks(payload, req, [`leadership-municipalities:${leadership.id}`])
      const fresh = await payload.findByID({
        collection: 'leadership',
        id: leadership.id,
        depth: 0,
        select: { municipalities: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      const currentMunicipalityIDs = uniqueRelationshipIds(fresh.municipalities)

      if (!assigned) {
        const next = currentMunicipalityIDs.filter((id) => !municipalityIds.includes(id))
        if (next.length === 0) {
          // Destructive exit: the dialog already listed what this removes
          // (declared votes, invites); the scope guard is the server-side
          // re-check. Intentional admin bypasses: the exits delete by id
          // (hooks) after the scope guard — same order as `personDelete.ts`.
          await assertPersonCapacityExitScope(payload, currentActor, req, currentMunicipalityIDs)
          const slugs = await municipalitySlugsOf(payload, req, currentMunicipalityIDs)
          await payload.delete({
            collection: 'votePledge',
            where: { leadership: { equals: leadership.id } },
            depth: 0,
            overrideAccess: true,
            req,
          })
          await payload.delete({
            collection: 'campaignInvite',
            where: { leadership: { equals: leadership.id } },
            depth: 0,
            // Intentional admin bypass: same exit guard as the pledge delete.
            overrideAccess: true,
            req,
          })
          await payload.delete({
            collection: 'leadership',
            id: leadership.id,
            depth: 0,
            // Intentional admin bypass: same exit guard as the pledge delete.
            overrideAccess: true,
            req,
          })
          return { leadershipID: null, slugs }
        }
      }

      const delta = await applyLeadershipMunicipalitiesDelta(
        payload,
        currentActor,
        req,
        leadership.id,
        currentMunicipalityIDs,
        municipalityIds,
        assigned,
      )
      return { leadershipID: delta.leadership ? leadership.id : null, slugs: delta.slugs }
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização da liderança.' },
  )
}

export const setPersonLeadershipMunicipalities = async (input: PersonLeadershipMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const { leadershipID, slugs } = await setPersonLeadershipMunicipalitiesRecord(
    payload,
    actor,
    input,
  )
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/liderancas', 'page')
  if (leadershipID !== null) revalidatePath(`/campanha/liderancas/${leadershipID}`, 'page')
  for (const slug of slugs) revalidatePath(`/campanha/municipios/${slug}`, 'page')
}

/**
 * C128 — the Aliada em column of a person: person-centric lifecycle write. The
 * first added municipality CREATES the dobradinha (contact, auto-slug from the
 * ficha name — a name already in use maps to the safe conflict message);
 * removing the last municipality DELETES the dobradinha (destructive exit,
 * scope-guarded as the leadership one). No extra confirmation for the exit:
 * the dobradinha carries no campaign data of its own beyond the row, so the
 * vínculo cleanup is automatic (rabbit hole decision of the intention plan).
 */
export const setPersonStateDeputyMunicipalitiesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PersonStateDeputyMembershipInput,
) => {
  const { contactId, municipalityIds, assigned } = personStateDeputyMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(payload, actor, PERSON_CELL_STAFF_MESSAGE, req)

      const deputies = await payload.find({
        collection: 'stateDeputy',
        where: { contact: { equals: contactId } },
        depth: 0,
        limit: 1,
        pagination: false,
        user: currentActor,
        overrideAccess: false,
      })
      const deputy = deputies.docs[0] as StateDeputy | undefined

      if (!deputy) {
        if (!assigned) return { stateDeputyID: null, slugs: [] }
        // The name invariant (advisory-locked) keeps the historical
        // unique-name rule at the StateDeputy boundary — same as the B157
        // inline create.
        const contact = await payload.findByID({
          collection: 'contact',
          id: contactId,
          depth: 0,
          select: { name: true },
          // Intentional admin bypass: the staff gate above is the
          // authorization; this read only resolves the dobradinha name.
          overrideAccess: true,
          req,
        })
        await assertStateDeputyNameAvailable(payload, req, contact.name ?? 'Contato')
        let created
        try {
          created = await payload.create({
            collection: 'stateDeputy',
            data: hookFilledCreateData<'stateDeputy'>({ contact: contactId }),
            depth: 0,
            user: currentActor,
            overrideAccess: false,
            req,
          })
        } catch (error) {
          const conflict = mapStaffEntityConflict(error, stateDeputyPolicy)
          if (conflict) throw conflict
          throw error
        }
        const batch = await applyStateDeputyMunicipalitiesBatch(
          payload,
          currentActor,
          req,
          created.id,
          municipalityIds,
          true,
        )
        return { stateDeputyID: created.id, slugs: batch.slugs }
      }

      if (!assigned) {
        const byDeputy = await municipalityIdsByStateDeputyIds(payload, [deputy.id])
        const currentMunicipalityIDs = byDeputy.get(deputy.id) ?? []
        const next = currentMunicipalityIDs.filter((id) => !municipalityIds.includes(id))
        if (next.length === 0) {
          // Destructive exit — the vínculos clean up via the FKs (set-null on
          // `municipality.stateDeputies` / `leadership.stateDeputies`), same
          // contract as `personDelete.ts`. Intentional admin bypass: the
          // delete runs by id (hooks) after the exit scope guard.
          await assertPersonCapacityExitScope(payload, currentActor, req, currentMunicipalityIDs)
          const slugs = await municipalitySlugsOf(payload, req, currentMunicipalityIDs)
          await payload.delete({
            collection: 'stateDeputy',
            id: deputy.id,
            depth: 0,
            overrideAccess: true,
            req,
          })
          return { stateDeputyID: null, slugs }
        }
      }

      const batch = await applyStateDeputyMunicipalitiesBatch(
        payload,
        currentActor,
        req,
        deputy.id,
        municipalityIds,
        assigned,
      )
      return {
        stateDeputyID: batch.slugs.length > 0 ? deputy.id : null,
        slugs: batch.slugs,
      }
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização da dobradinha.' },
  )
}

export const setPersonStateDeputyMunicipalities = async (
  input: PersonStateDeputyMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  const { stateDeputyID, slugs } = await setPersonStateDeputyMunicipalitiesRecord(
    payload,
    actor,
    input,
  )
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
  if (stateDeputyID !== null) revalidatePath(`/campanha/dobradinhas/${stateDeputyID}`, 'page')
  for (const slug of slugs) revalidatePath(`/campanha/municipios/${slug}`, 'page')
}

/**
 * C128 — read-only preview for the destructive-exit confirmation dialog
 * (`PeopleCapacityExitDialog`): what the exit removes, verbatim. The same
 * scope guards the exit write runs inside its transaction — the dialog can
 * never describe a destruction the write would refuse.
 */
export const getPersonCapacityExitManifestAction = async (input: unknown) => {
  const data = personCapacityExitSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  return loadPersonCapacityExitManifest(payload, actor, data)
}

/**
 * C116 — the Assessorado column: the advisor delta is applied to EVERY entity
 * of the person (leadership and/or dobradinha) in one transaction — the column
 * is a person attribute, so adding/removing an advisor touches both vínculos
 * when both exist. Unrestricted-only (B156 rule: advisor assignment is
 * coordinator/candidate).
 */
export const setPersonAdvisorMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PersonAdvisorMembershipInput,
) => {
  const { contactId, advisorId, assigned } = personAdvisorMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      await reloadUnrestrictedActor(payload, actor, PERSON_ADVISORS_UNRESTRICTED_MESSAGE, req)

      const [leaderships, deputies] = await Promise.all([
        payload.find({
          collection: 'leadership',
          where: { contact: { equals: contactId } },
          depth: 0,
          pagination: false,
          select: { id: true, advisors: true },
          // Intentional bypass: the unrestricted gate above is the
          // authorization; the `advisors` field is admin-only by field access
          // (same contract as the C99/B156 per-entity cells).
          overrideAccess: true,
          req,
        }),
        payload.find({
          collection: 'stateDeputy',
          where: { contact: { equals: contactId } },
          depth: 0,
          pagination: false,
          select: { id: true, advisors: true },
          // Intentional bypass: same gate as the leadership read above.
          overrideAccess: true,
          req,
        }),
      ])

      const touched: number[] = []
      for (const leadership of leaderships.docs) {
        await acquireTextAdvisoryLocks(payload, req, [`leadership-advisors:${leadership.id}`])
        const currentAdvisorIDs = uniqueRelationshipIds(leadership.advisors)
        const nextAdvisorIDs = nextLeadershipAdvisorIdsAfterMembership(
          currentAdvisorIDs,
          advisorId,
          assigned,
        )
        if (nextAdvisorIDs === null) continue
        // Intentional bypass: the unrestricted gate above is the authorization;
        // the `advisors` field is admin-only by field access (C99 contract).
        await payload.update({
          collection: 'leadership',
          id: leadership.id,
          data: { advisors: nextAdvisorIDs },
          depth: 0,
          overrideAccess: true,
          req,
        })
        touched.push(leadership.id)
      }

      for (const deputy of deputies.docs) {
        await acquireTextAdvisoryLocks(payload, req, [`state-deputy-advisors:${deputy.id}`])
        const currentAdvisorIDs = uniqueRelationshipIds(deputy.advisors)
        const nextAdvisorIDs = nextStateDeputyAdvisorIdsAfterMembership(
          currentAdvisorIDs,
          advisorId,
          assigned,
        )
        if (nextAdvisorIDs === null) continue
        // Intentional bypass: same gate as the leadership write above.
        await payload.update({
          collection: 'stateDeputy',
          id: deputy.id,
          data: { advisors: nextAdvisorIDs },
          depth: 0,
          overrideAccess: true,
          req,
        })
        touched.push(deputy.id)
      }

      if (touched.length === 0) {
        throw new Error(PERSON_CONTACT_INVALID_MESSAGE)
      }
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização dos assessores.' },
  )
}

export const setPersonAdvisorMembership = async (input: PersonAdvisorMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  await setPersonAdvisorMembershipRecord(payload, actor, input)
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/liderancas', 'page')
  revalidatePath('/campanha/dobradinhas', 'page')
}
