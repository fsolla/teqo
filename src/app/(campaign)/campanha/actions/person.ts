'use server'

import { revalidatePath } from 'next/cache'

import { toggleMunicipalityAdvisorMembership } from '@/app/(campaign)/campanha/actions/municipality'
import { nextLeadershipAdvisorIdsAfterMembership } from '@/lib/leadershipAdvisorMembership'
import { reorderWithPrimaryPhone } from '@/lib/phone'
import { uniqueRelationshipIds } from '@/lib/relationship'
import { contactFieldUpdateSchema, type ContactFieldUpdateInput } from '@/lib/schemas/contact'
import {
  PERSON_ADVISORS_UNRESTRICTED_MESSAGE,
  PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE,
  PERSON_ASSESSORA_UNRESTRICTED_MESSAGE,
  PERSON_CELL_NOT_IN_SCOPE_MESSAGE,
  PERSON_CELL_STAFF_MESSAGE,
  PERSON_CONTACT_INVALID_MESSAGE,
  personAdvisorMembershipSchema,
  personAssessoraMembershipSchema,
  type PersonAdvisorMembershipInput,
  type PersonAssessoraMembershipInput,
} from '@/lib/schemas/personCell'
import {
  PERSON_DELETE_FORBIDDEN_MESSAGE,
  personDeleteInputSchema,
} from '@/lib/schemas/personDelete'
import { nextStateDeputyAdvisorIdsAfterMembership } from '@/lib/stateDeputyAdvisorMembership'
import type { CampaignUser, Contact } from '@/payload-types'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { deletePersonRecord, loadPersonDeleteManifest } from '@/utilities/people/personDelete'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import type { Payload } from 'payload'

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
 * C116 — the Assessora column of a person: toggles the person's staff account
 * on `municipality.advisors` for a batch of municipalities (one territory / ZE
 * chip or a "Salvador (19)" group), in ONE transaction. Unrestricted-only
 * (`canAssignMunicipalityAdvisors`), and the person must have EXACTLY ONE
 * staff account — with more, "which account" is ambiguous, so the server
 * refuses with a safe message (the cell renders read-only for those rows).
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

      if (accounts.docs.length === 0) throw new Error(PERSON_ASSESSORA_NO_ACCOUNT_MESSAGE)
      if (accounts.docs.length > 1) throw new Error(PERSON_ASSESSORA_MULTI_ACCOUNT_MESSAGE)
      const accountId = accounts.docs[0].id

      for (const municipalityId of municipalityIds) {
        await toggleMunicipalityAdvisorMembership(payload, req, municipalityId, accountId, assigned)
      }
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização da carteira.' },
  )
}

export const setPersonAssessoraMembership = async (input: PersonAssessoraMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  await setPersonAssessoraMembershipRecord(payload, actor, input)
  revalidatePath('/campanha/pessoas', 'page')
  revalidatePath('/campanha/assessores', 'page')
  revalidateMunicipalityListPaths({ scope: 'list' })
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
