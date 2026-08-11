'use server'

import { randomBytes } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextAdvisorIdsAfterMembership } from '@/lib/municipalityAdvisorMembership'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  ADVISOR_EMAIL_CONFLICT_MESSAGE,
  ADVISOR_ROLE_REQUIRED_MESSAGE,
  ADVISOR_SELF_ACCOUNT_MESSAGE,
  ADVISOR_UNRESTRICTED_MESSAGE,
  PLACEHOLDER_RESET_MESSAGE,
  advisorCreateSchema,
  advisorMunicipalitiesBatchSchema,
  advisorPasswordResetSchema,
  advisorProfileUpdateSchema,
  isPlanilhaPlaceholderEmail,
  type AdvisorCreateInput,
  type AdvisorMunicipalitiesBatchInput,
  type AdvisorPasswordResetInput,
  type AdvisorProfileUpdateInput,
} from '@/lib/schemas/advisor'
import { contactPhonesSchema } from '@/lib/schemas/contact'
import type { CampaignUser } from '@/payload-types'
import {
  getCampaignActionContext,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import {
  assertCampaignEmailConfigured,
  isCampaignEmailConfigured,
} from '@/utilities/campaignPasswordReset'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const revalidateAdvisorDetailPath = (advisorId: number) => {
  revalidatePath(`/campanha/assessores/${advisorId}`, 'page')
}

/** For writes that change the LIST itself — a new advisor, or a renamed one. */
const revalidateAdvisorPaths = (advisorId?: number) => {
  revalidatePath('/campanha/assessores', 'page')
  if (advisorId !== undefined) revalidateAdvisorDetailPath(advisorId)
}

type AdvisorAccount = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  role: CampaignUser['role']
}

const assertTargetAdvisor = async (
  payload: Payload,
  advisorId: number,
  actorId: number,
): Promise<AdvisorAccount> => {
  const target = await payload.findByID({
    collection: 'campaignUser',
    id: advisorId,
    depth: 0,
    select: { name: true, email: true, phone: true, role: true },
    overrideAccess: true,
  })

  if (target.role !== 'advisor') {
    throw new Error(ADVISOR_ROLE_REQUIRED_MESSAGE)
  }
  if (String(target.id) === String(actorId)) {
    throw new Error(ADVISOR_SELF_ACCOUNT_MESSAGE)
  }

  return target
}

const translateUniqueEmailConflict = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error)
  // Payload may surface the unique email collision as email, username, or a
  // generic "field is invalid" ValidationError depending on auth config.
  if (/email|username|duplicate key|unique/i.test(message)) {
    throw new Error(ADVISOR_EMAIL_CONFLICT_MESSAGE)
  }
  throw error instanceof Error ? error : new Error(String(error))
}

export const createAdvisorRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: AdvisorCreateInput,
) => {
  const data = advisorCreateSchema.parse(input)
  const currentActor = await reloadUnrestrictedActor(payload, actor, ADVISOR_UNRESTRICTED_MESSAGE)

  try {
    const created = await payload.create({
      collection: 'campaignUser',
      data: hookFilledCreateData<'campaignUser'>({
        name: data.name,
        email: data.email,
        role: 'advisor',
        password: randomBytes(24).toString('base64url'),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      }),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    })
    return created
  } catch (error) {
    return translateUniqueEmailConflict(error)
  }
}

export const createAdvisor = async (input: AdvisorCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const created = await createAdvisorRecord(payload, actor, input)
  revalidateAdvisorPaths()
  return created
}

export const updateAdvisorProfileRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: AdvisorProfileUpdateInput,
) => {
  const { id, ...fields } = advisorProfileUpdateSchema.parse(input)
  const currentActor = await reloadUnrestrictedActor(payload, actor, ADVISOR_UNRESTRICTED_MESSAGE)
  await assertTargetAdvisor(payload, id, currentActor.id)

  const data: {
    name?: string
    email?: string
    phone?: string | null
  } = {}
  if (fields.name !== undefined) data.name = fields.name
  if (fields.email !== undefined) data.email = fields.email
  if (fields.phone !== undefined) data.phone = fields.phone

  try {
    const updated = await payload.update({
      collection: 'campaignUser',
      id,
      data,
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    })
    return updated
  } catch (error) {
    return translateUniqueEmailConflict(error)
  }
}

export const updateAdvisorProfile = async (input: AdvisorProfileUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const updated = await updateAdvisorProfileRecord(payload, actor, input)
  revalidateAdvisorPaths(updated.id)
  return updated
}

/**
 * C112 — write the advisor's ficha (Contact) phone list. The advisor page is
 * unrestricted-staff gated; the ficha is the person's record, distinct from
 * the account's single channel phone.
 */
export const updateAdvisorContactFicha = async (input: { contactId: number; phones: string[] }) => {
  const { payload, actor } = await getCampaignActionContext()
  await reloadUnrestrictedActor(payload, actor, ADVISOR_UNRESTRICTED_MESSAGE)
  // Same zod gate as the other ficha editors: valid mobiles, no duplicates.
  const parsed = contactPhonesSchema.parse(input.phones)

  await payload.update({
    collection: 'contact',
    id: input.contactId,
    data: { phones: parsed.map((value) => ({ value })) },
    depth: 0,
    // Intentional admin bypass: the unrestricted route gate above established
    // staff scope; the ficha is the advisor's own normalized Contact.
    overrideAccess: true,
  })
  revalidatePath('/campanha/assessores', 'page')
}

export const setAdvisorMunicipalitiesBatchRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: AdvisorMunicipalitiesBatchInput,
) => {
  const { advisorId, municipalityIds, assigned } = advisorMunicipalitiesBatchSchema.parse(input)
  const uniqueMunicipalityIds = [...municipalityIds].sort((left, right) => left - right)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadUnrestrictedActor(
        payload,
        actor,
        ADVISOR_UNRESTRICTED_MESSAGE,
        req,
      )
      await assertTargetAdvisor(payload, advisorId, currentActor.id)

      await acquireTextAdvisoryLocks(
        payload,
        req,
        uniqueMunicipalityIds.map((id) => `municipality-advisors:${id}`),
      )

      // Every município actually changed, not just the last one: since B34 this
      // is the only advisor write path, and a território chip moves up to 30 in
      // one call — revalidating one would leave 29 detail pages stale.
      const changedSlugs: string[] = []

      for (const municipalityId of uniqueMunicipalityIds) {
        const municipality = await payload.findByID({
          collection: 'municipality',
          id: municipalityId,
          depth: 0,
          select: { advisors: true, slug: true },
          overrideAccess: true,
          req,
        })

        const currentAdvisorIDs = uniqueRelationshipIds(municipality.advisors)
        const nextAdvisorIDs = nextAdvisorIdsAfterMembership(currentAdvisorIDs, advisorId, assigned)
        if (nextAdvisorIDs === null) continue

        // Intentional admin bypass: unrestricted role verified above; advisors
        // field update access is admin-only in the collection config.
        await payload.update({
          collection: 'municipality',
          id: municipalityId,
          data: { advisors: nextAdvisorIDs },
          depth: 0,
          overrideAccess: true,
          req,
        })
        if (typeof municipality.slug === 'string') changedSlugs.push(municipality.slug)
      }

      return { slugs: changedSlugs }
    },
    { beginFailureMessage: 'Não foi possível atualizar a carteira do assessor.' },
  )
}

export const setAdvisorMunicipalitiesBatch = async (input: AdvisorMunicipalitiesBatchInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const result = await setAdvisorMunicipalitiesBatchRecord(payload, actor, input)
  // A no-op batch changed nothing, so there is nothing to revalidate — the guard
  // the other three chip wrappers already had. `/campanha/assessores` itself
  // stays out: the cell that calls this is on it and already shows the toggle.
  if (result.slugs.length > 0) {
    revalidateMunicipalityListPaths({ scope: 'list' })
    for (const slug of result.slugs) {
      revalidateMunicipalityListPaths({ slug, scope: 'detail' })
    }
    revalidateAdvisorDetailPath(input.advisorId)
  }
  return result
}

export const sendAdvisorPasswordResetRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: AdvisorPasswordResetInput,
) => {
  const { advisorId } = advisorPasswordResetSchema.parse(input)
  const currentActor = await reloadUnrestrictedActor(payload, actor, ADVISOR_UNRESTRICTED_MESSAGE)
  const target = await assertTargetAdvisor(payload, advisorId, currentActor.id)

  if (!target.email || isPlanilhaPlaceholderEmail(target.email)) {
    throw new Error(PLACEHOLDER_RESET_MESSAGE)
  }

  assertCampaignEmailConfigured()

  await payload.forgotPassword({
    collection: 'campaignUser',
    data: { email: target.email },
    disableEmail: !isCampaignEmailConfigured(),
  })

  return { email: target.email }
}

export const sendAdvisorPasswordReset = async (input: AdvisorPasswordResetInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return sendAdvisorPasswordResetRecord(payload, actor, input)
}
