'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import {
  STATE_DEPUTY_MUNICIPALITIES_STAFF_MESSAGE,
  stateDeputyCreateSchema,
  stateDeputyMunicipalitiesBatchSchema,
  stateDeputyUpdateSchema,
  type StateDeputyCreateInput,
  type StateDeputyMunicipalitiesBatchInput,
  type StateDeputyUpdateInput,
} from '@/lib/schemas/stateDeputy'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { runStaffEntityMutation, type StaffEntityPolicy } from '@/utilities/campaignEntityActions'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { revalidateMunicipalityListPaths } from '@/utilities/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { uniqueRelationshipIds } from '@/utilities/relationship'

const stateDeputyPolicy: StaffEntityPolicy = {
  staffMessage: 'Somente a coordenação e a assessoria gerenciam dobradinhas.',
  conflictPattern: /state_deputy_(name|slug)|duplicate key/i,
  conflictMessage: 'Já existe uma dobradinha com este nome.',
}

const createStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyCreateInput,
) => {
  const data = stateDeputyCreateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, stateDeputyPolicy, (currentActor) =>
    payload.create({
      collection: 'stateDeputy',
      data: hookFilledCreateData<'stateDeputy'>(data),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
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

export const createStateDeputy = async (input: StateDeputyCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createStateDeputyRecord(payload, actor, input)
}

export const updateStateDeputy = async (input: StateDeputyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateStateDeputyRecord(payload, actor, input)
}

const revalidateStateDeputyMunicipalityPaths = (
  stateDeputySlug: string | undefined,
  municipalitySlugs: readonly string[],
) => {
  revalidatePath('/campanha/dobradinhas', 'page')
  if (stateDeputySlug) {
    revalidatePath(`/campanha/dobradinhas/${stateDeputySlug}`, 'page')
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
export const setStateDeputyMunicipalitiesBatchRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyMunicipalitiesBatchInput,
) => {
  const { stateDeputyId, municipalityIds, assigned } =
    stateDeputyMunicipalitiesBatchSchema.parse(input)
  const uniqueMunicipalityIds = [...new Set(municipalityIds)].sort((left, right) => left - right)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(
        payload,
        actor,
        STATE_DEPUTY_MUNICIPALITIES_STAFF_MESSAGE,
        req,
      )

      await acquireTextAdvisoryLocks(
        payload,
        req,
        uniqueMunicipalityIds.map((id) => `municipality-state-deputies:${id}`),
      )

      // Intentional admin bypass: only used to resolve the slug of the
      // touched dobradinha for a targeted revalidate; existence is otherwise
      // enforced by Payload's relationship validation on `update` (same
      // precedent as `setLeadershipStateDeputyMembershipRecord`, B31).
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

      return { stateDeputySlug, slugs: changedSlugs }
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
    revalidateStateDeputyMunicipalityPaths(result.stateDeputySlug, result.slugs)
  }
  return result
}
