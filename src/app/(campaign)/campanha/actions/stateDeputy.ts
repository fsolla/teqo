'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

import {
  CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
  CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE,
  type CampaignListNextPageResult,
} from '@/lib/campaignListPage'
import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  STATE_DEPUTY_ADVISORS_UNRESTRICTED_MESSAGE,
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
  municipalityStateDeputyCreateSchema,
  stateDeputyAdvisorMembershipSchema,
  stateDeputyCreateSchema,
  stateDeputyMunicipalitiesBatchSchema,
  stateDeputyUpdateSchema,
  type MunicipalityStateDeputyCreateInput,
  type StateDeputyAdvisorMembershipInput,
  type StateDeputyCreateInput,
  type StateDeputyMunicipalitiesBatchInput,
  type StateDeputyUpdateInput,
} from '@/lib/schemas/stateDeputy'
import { nextStateDeputyAdvisorIdsAfterMembership } from '@/lib/stateDeputyAdvisorMembership'
import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  mapStaffEntityConflict,
  runStaffEntityMutation,
  type StaffEntityPolicy,
} from '@/utilities/campaignEntityActions'
import { rawSearchParamsFromQueryString, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  loadStateDeputyListPageData,
  type StateDeputyRowViewModel,
} from '@/utilities/stateDeputyData'
import { parseStateDeputyListParams } from '@/utilities/stateDeputyListUrl'

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
        select: { advisors: true, slug: true },
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

      // No-op: nothing to write, and nothing for the caller to revalidate —
      // the slug lookup below exists only to target that revalidate.
      if (nextAdvisorIDs === null) {
        return { stateDeputySlug: undefined }
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

      return { stateDeputySlug: stateDeputy.slug }
    },
    { beginFailureMessage: 'Não foi possível atualizar os assessores da dobradinha.' },
  )
}

export const setStateDeputyAdvisorMembership = async (input: StateDeputyAdvisorMembershipInput) => {
  const { payload, actor } = await getCampaignActionContext()
  const { stateDeputySlug } = await setStateDeputyAdvisorMembershipRecord(payload, actor, input)
  // The list is deliberately absent: the chip cell that calls this IS on it and
  // already shows the toggle. The detail page is the route an actor cannot see
  // from here — same reasoning as the leadership twin (B31).
  if (stateDeputySlug) revalidatePath(`/campanha/dobradinhas/${stateDeputySlug}`, 'page')
  return stateDeputySlug
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

/**
 * B157 — name-only (+ party via `Nome (PARTIDO)`) inline create from the
 * "Dobradinhas" column of `/campanha/municipios`. Creates the `stateDeputy`
 * and assigns it to the município in the SAME transaction: if the assign
 * fails (out-of-scope município, cap), the create rolls back with it — no
 * orphan, same contract as `createMunicipalityAdvisorRecord` (B154). The
 * unique `name`/`slug` violation is mapped to the safe conflict message; the
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
        created = await payload.create({
          collection: 'stateDeputy',
          data: hookFilledCreateData<'stateDeputy'>({ name, ...(party ? { party } : {}) }),
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      } catch (error) {
        // Same translation as the shared owner (`runStaffEntityMutation`): the
        // pattern covers the insert race, `ValidationError` covers Payload's
        // pre-insert unique check — in this create path the only validation
        // left after zod IS the unique name/slug check.
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
          name: created.name,
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
    revalidateStateDeputyMunicipalityPaths(result.stateDeputy.slug, [result.municipalitySlug])
  }
  return result
}

export type MunicipalityStateDeputyCreateResult = Awaited<
  ReturnType<typeof createMunicipalityStateDeputyRecord>
>

/**
 * B161 — incremental load for the continuous list (see demand.ts twin).
 */
export const fetchNextStateDeputyListPage = async (
  query: string,
  page: number,
): Promise<CampaignListNextPageResult<StateDeputyRowViewModel>> => {
  const nextPage = strictDecimalInteger(String(page))
  if (!nextPage || nextPage < 2) {
    return { status: 'error', message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE }
  }

  const actor = await getCampaignUser()
  if (!actor) return { status: 'error', message: CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE }
  if (!isCampaignStaff(actor)) return { status: 'error', message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE }

  const payload = await getPayload({ config })
  const state = parseStateDeputyListParams(rawSearchParamsFromQueryString(query))
  const { rows, totalDocs, totalPages } = await loadStateDeputyListPageData(
    payload,
    actor,
    state,
    nextPage,
  )

  return { status: 'ok', rows, totalDocs, hasMore: nextPage < totalPages }
}
