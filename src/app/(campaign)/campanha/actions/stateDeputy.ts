'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
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
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const stateDeputyPolicy: StaffEntityPolicy = {
  staffMessage: STATE_DEPUTY_STAFF_MESSAGE,
  conflictPattern: /state_deputy_(name|slug)|duplicate key/i,
  conflictMessage: STATE_DEPUTY_CONFLICT_MESSAGE,
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

/**
 * `/campanha/dobradinhas` — the list this chip cell lives on since B37 — is
 * deliberately absent, on the same reasoning as the leadership twin: the cell
 * already shows the toggle, so refreshing its own list re-serializes the table
 * and the município index for a change already on screen.
 */
const revalidateStateDeputyMunicipalityPaths = (
  stateDeputySlug: string | undefined,
  municipalitySlugs: readonly string[],
) => {
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

      // Resolved AFTER the loop, and only when something changed: the slug
      // exists solely to target the revalidate, which the caller skips on a
      // no-op batch — so on a no-op this read was pure waste (the guard the
      // `setLeadershipMunicipalitiesMembershipRecord` twin already had).
      // Intentional admin bypass: existence is otherwise enforced by Payload's
      // relationship validation on `update` (precedent:
      // `setLeadershipStateDeputyMembershipRecord`, B31).
      const stateDeputySlug =
        changedSlugs.length > 0
          ? (
              await payload.findByID({
                collection: 'stateDeputy',
                id: stateDeputyId,
                depth: 0,
                select: { slug: true },
                overrideAccess: true,
                req,
              })
            ).slug
          : undefined

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
