'use server'

import type { Payload } from 'payload'

import {
  ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE,
  ACTIVITY_OUT_OF_SCOPE_MESSAGE,
  ACTIVITY_RESCHEDULE_FAILED_MESSAGE,
  ACTIVITY_RESULT_REQUIRED_MESSAGE,
  ACTIVITY_RESULT_STAFF_MESSAGE,
  ACTIVITY_RESULT_TOO_LONG_MESSAGE,
  ACTIVITY_TASK_NOT_FOUND_MESSAGE,
  ACTIVITY_UPDATE_BODY_REQUIRED_MESSAGE,
  ACTIVITY_UPDATE_BODY_TOO_LONG_MESSAGE,
  activityAgendaRequestSchema,
  activityCreateSchema,
  activityDemandDraftsSchema,
  activityRescheduleSchema,
  activityUpdateSchema,
  type ActivityAgendaRequest,
  type ActivityCreateInput,
  type ActivityDemandDraft,
  type ActivityRescheduleInput,
  type ActivityUpdateInput,
} from '@/lib/schemas/activity'
import type { Activity, CampaignUser } from '@/payload-types'
import {
  parseActivityCreateFormData,
  parseActivityUpdateFormData,
  type ParsedTourDraftFormData,
} from '@/utilities/activityFormData'
import { mapActivityOverlayError } from '@/utilities/activityOverlayErrors'
import { loadActivityAgendaEventsData } from '@/utilities/activityPageData'
import { activityFormSelect, toActivityFormViewModel } from '@/utilities/activityViewModels'
import {
  canCampaignUserRescheduleActivity,
  getWritableMunicipalityIds,
  isCampaignStaff,
} from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  MAX_TOUR_STOPS,
  TOUR_EMPTY_MESSAGE,
  TOUR_MAX_STOPS_MESSAGE,
  TOUR_OUT_OF_SCOPE_MESSAGE,
  TOUR_STAFF_ONLY_MESSAGE,
} from '@/utilities/visit/visitPlannerViews'

const MAX_ACTIVITY_UPDATE_BODY_LENGTH = 4000
const MAX_ACTIVITY_RESULT_SUMMARY_LENGTH = 6000

export const loadActivityAgendaEventsRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActivityAgendaRequest,
) => {
  const request = activityAgendaRequestSchema.parse(input)
  const currentActor = await reloadCampaignActor(payload, actor)
  return loadActivityAgendaEventsData(payload, currentActor, request)
}

export const rescheduleActivityRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActivityRescheduleInput,
) => {
  const schedule = activityRescheduleSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`activity:${schedule.id}`])
      const current = await payload.findByID({
        collection: 'activity',
        id: schedule.id,
        depth: 0,
        select: { deputyPresent: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      if (!canCampaignUserRescheduleActivity(currentActor, Boolean(current.deputyPresent))) {
        throw new Error(ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE)
      }

      return payload.update({
        collection: 'activity',
        id: schedule.id,
        data: { startAt: schedule.startAt, endAt: schedule.endAt },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a remarcação da atividade.' },
  )
}

export const createActivityRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActivityCreateInput,
  demandDrafts: ActivityDemandDraft[] = [],
) => {
  const raw = activityCreateSchema.parse(input)
  // Payload date fields accept string | undefined, not null. Strip nulls.
  const data = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== null),
  ) as Record<string, unknown>
  const demands = activityDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      // C141 — `canCreateActivity` is a plain staff boolean (Payload cannot
      // express a per-município constraint on create), so the individual
      // create must check the municipality against the WRITE scope itself —
      // with Visão "Tudo" + Edição "Carteira" the read widens while the
      // carteira stays the edit boundary (same rule as the giro batch).
      const writableIDs = await getWritableMunicipalityIds(payload, currentActor, req)
      if (writableIDs !== null && !writableIDs.includes(raw.municipality)) {
        throw new Error(ACTIVITY_OUT_OF_SCOPE_MESSAGE)
      }

      const activity = await payload.create({
        collection: 'activity',
        data: hookFilledCreateData<'activity'>(data),
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      for (const demand of demands) {
        await payload.create({
          collection: 'campaignDemand',
          data: hookFilledCreateData<'campaignDemand'>({
            ...demand,
            municipality: raw.municipality,
            activity: activity.id,
          }),
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return activity
    },
    { beginFailureMessage: 'Não foi possível iniciar a criação da atividade.' },
  )
}

/**
 * E13 — one giro becomes N draft activities in ONE transaction: a giro that
 * half-exists is worse than none, because the coordination would work from a
 * route with a hole in it. There is no `tour` entity: the giro IS its stops,
 * derivable from `deputyPresent` + território + date window (the plan's own
 * decision — persisting it needs a third real giro to justify the schema).
 *
 * Every stop goes through the same `activityCreateSchema` and the same
 * `overrideAccess: false` create as the manual form, so an advisor cannot seed a
 * município outside their portfolio by composing a giro over it.
 */
export const createTourDraftActivitiesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  { tourName, note, stops }: ParsedTourDraftFormData,
) => {
  if (stops.length === 0) throw new Error(TOUR_EMPTY_MESSAGE)
  if (stops.length > MAX_TOUR_STOPS) throw new Error(TOUR_MAX_STOPS_MESSAGE)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) throw new Error(TOUR_STAFF_ONLY_MESSAGE)

      // `activity` create access is a plain staff boolean — Payload cannot express
      // a per-município constraint on create — so a batch assembled from a scoped
      // composition is checked against that same scope here, fail-closed. Without
      // it, an advisor could seed drafts across the whole state by posting ids
      // the composer never offered them.
      const municipalityIDs = [...new Set(stops.map((stop) => stop.municipality))]
      const readable = await payload.find({
        collection: 'municipality',
        where: { id: { in: municipalityIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { name: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      if (readable.docs.length !== municipalityIDs.length) {
        throw new Error(TOUR_OUT_OF_SCOPE_MESSAGE)
      }

      // C141 — the read above proves the stops EXIST, but the stop set must sit
      // inside the WRITE scope: with Visão "Tudo" + Edição "Carteira" the read
      // widens while the carteira stays the edit boundary. `null` = whole
      // catalog (unrestricted or editing=tudo); `[]` = no writes at all.
      const writableIDs = await getWritableMunicipalityIds(payload, currentActor, req)
      if (writableIDs !== null && !municipalityIDs.every((id) => writableIDs.includes(id))) {
        throw new Error(TOUR_OUT_OF_SCOPE_MESSAGE)
      }

      // The names come from the same read that authorized the stops, so a stop's
      // title always names the município it was actually created in, and the
      // giro reads as one set in the Atividades list.
      const nameByID = new Map(readable.docs.map((doc) => [doc.id, doc.name]))

      const created = []
      for (const stop of stops) {
        // Tour stops don't carry a startAt — the coordination sets it later.
        // We bypass activityCreateSchema (which requires startAt) and build
        // the create data directly; the beforeValidate hook allows this via
        // the isTourDraft context flag.
        const data = {
          ...stop,
          title: `${tourName} — ${nameByID.get(stop.municipality)}`,
          status: 'confirmado' as const,
          deputyPresent: true,
          ...(note ? { description: note } : {}),
          tags: stop.tags ?? [],
        }

        created.push(
          await payload.create({
            collection: 'activity',
            data: hookFilledCreateData<'activity'>(data),
            depth: 0,
            user: currentActor,
            overrideAccess: false,
            context: { isTourDraft: true },
            req,
          }),
        )
      }

      return created
    },
    { beginFailureMessage: 'Não foi possível iniciar a criação dos rascunhos do giro.' },
  )
}

const updateActivityRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActivityUpdateInput,
  demandDrafts: ActivityDemandDraft[] = [],
) => {
  const { id, ...rawData } = activityUpdateSchema.parse(input)
  // Payload date fields accept string | undefined, not null.
  // Strip nulls only for required-ish fields; keep null for optional
  // fields (endAt) so clearing them works.
  const data = {
    ...Object.fromEntries(
      Object.entries(rawData).filter(([key, value]) => {
        if (value === null && (key === 'startAt' || key === 'status')) return false
        return true
      }),
    ),
  } as Record<string, unknown>
  const demands = activityDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`activity:${id}`])

      const activity = (await payload.update({
        collection: 'activity',
        id,
        data,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })) as unknown as Activity

      const municipality =
        typeof activity.municipality === 'number' ? activity.municipality : activity.municipality.id
      for (const demand of demands) {
        await payload.create({
          collection: 'campaignDemand',
          data: hookFilledCreateData<'campaignDemand'>({
            ...demand,
            municipality,
            activity: activity.id,
          }),
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return activity
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização da atividade.' },
  )
}

const setActivityLifecycleStatusRecord = async (
  payload: Payload,
  actor: CampaignUser,
  id: number,
  status: 'realizado' | 'cancelado',
) =>
  withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      return payload.update({
        collection: 'activity',
        id,
        data: { status },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível atualizar o status da atividade.' },
  )

const toggleActivityTaskRecord = async (
  payload: Payload,
  actor: CampaignUser,
  activityId: number,
  taskId: string,
  done: boolean,
) =>
  withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`activity:${activityId}`])
      const activity = await payload.findByID({
        collection: 'activity',
        id: activityId,
        depth: 0,
        select: { tasks: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const tasks = activity.tasks ?? []
      const taskIndex = tasks.findIndex((task) => task.id === taskId)
      if (taskIndex === -1) throw new Error(ACTIVITY_TASK_NOT_FOUND_MESSAGE)

      const nextTasks = tasks.map((task, index) => (index === taskIndex ? { ...task, done } : task))

      return payload.update({
        collection: 'activity',
        id: activityId,
        data: { tasks: nextTasks },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'taskToggle' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível atualizar a tarefa da atividade.' },
  )

const appendActivityUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  activityId: number,
  body: string,
) => {
  const trimmedBody = body.trim()
  if (!trimmedBody) throw new Error(ACTIVITY_UPDATE_BODY_REQUIRED_MESSAGE)
  if (trimmedBody.length > MAX_ACTIVITY_UPDATE_BODY_LENGTH) {
    throw new Error(ACTIVITY_UPDATE_BODY_TOO_LONG_MESSAGE)
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`activity:${activityId}`])
      const activity = await payload.findByID({
        collection: 'activity',
        id: activityId,
        depth: 0,
        select: { updates: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const updates = activity.updates ?? []
      const nextUpdates = [...updates, { body: trimmedBody }]

      return payload.update({
        collection: 'activity',
        id: activityId,
        data: { updates: nextUpdates },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'appendUpdate' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível registrar a atualização da atividade.' },
  )
}

const registerActivityResult = async (
  payload: Payload,
  actor: CampaignUser,
  activityId: number,
  resultSummary: string,
  mediaIDs: number[],
) => {
  const trimmedSummary = resultSummary.trim()
  if (!trimmedSummary) throw new Error(ACTIVITY_RESULT_REQUIRED_MESSAGE)
  if (trimmedSummary.length > MAX_ACTIVITY_RESULT_SUMMARY_LENGTH) {
    throw new Error(ACTIVITY_RESULT_TOO_LONG_MESSAGE)
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(ACTIVITY_RESULT_STAFF_MESSAGE)
      }

      return payload.update({
        collection: 'activity',
        id: activityId,
        data: {
          resultSummary: trimmedSummary,
          // Media upload is a follow-up; an empty list must not wipe media
          // attached elsewhere (e.g. via the Payload admin).
          ...(mediaIDs.length > 0 ? { resultMedia: mediaIDs } : {}),
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível registrar o resultado da atividade.' },
  )
}

export const loadActivityAgendaEvents = async (input: ActivityAgendaRequest) => {
  const { payload, actor } = await getCampaignActionContext()
  return loadActivityAgendaEventsRecord(payload, actor, input)
}

export type ActivityRescheduleResult = { ok: true } | { ok: false; message: string }

export const rescheduleActivity = async (
  input: ActivityRescheduleInput,
): Promise<ActivityRescheduleResult> => {
  try {
    const { payload, actor } = await getCampaignActionContext()
    await rescheduleActivityRecord(payload, actor, input)
    return { ok: true }
  } catch (error) {
    const message =
      error instanceof Error && error.message === ACTIVITY_DEPUTY_RESCHEDULE_FORBIDDEN_MESSAGE
        ? error.message
        : ACTIVITY_RESCHEDULE_FAILED_MESSAGE
    return { ok: false, message }
  }
}

export type ActivityOverlayResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

/**
 * C123 — server surface for the agenda's single create/edit overlay. Both
 * actions reuse the full-form FormData parsers (`parseActivity*FormData`) and
 * the transactional `*Record` writes (`overrideAccess: false` with the actor,
 * the advisor's portfolio scope inherited from the full form), returning a
 * result instead of throwing so the overlay stays open on a failure — same
 * `{ ok }` contract the old inline quick create established.
 */
export const createActivityOverlay = async (formData: FormData): Promise<ActivityOverlayResult> => {
  try {
    const { demands, ...activityInput } = parseActivityCreateFormData(formData)
    const { payload, actor } = await getCampaignActionContext()
    await createActivityRecord(payload, actor, activityInput, demands)
    return { ok: true }
  } catch (error) {
    return { ok: false, ...mapActivityOverlayError(error) }
  }
}

export const updateActivityOverlay = async (formData: FormData): Promise<ActivityOverlayResult> => {
  try {
    const { demands, ...activityInput } = parseActivityUpdateFormData(formData)
    const { payload, actor } = await getCampaignActionContext()
    await updateActivityRecord(payload, actor, activityInput, demands)
    return { ok: true }
  } catch (error) {
    return { ok: false, ...mapActivityOverlayError(error) }
  }
}

/**
 * C123 — edit-mode data for the overlay: the full form view model of one
 * activity, read through the same access the detail page uses (`overrideAccess:
 * false` with the actor), so an advisor can only edit activities in their scope.
 */
export const loadActivityEditDraftRecord = async (
  payload: Payload,
  actor: CampaignUser,
  activityId: number,
) => {
  const currentActor = await reloadCampaignActor(payload, actor)
  const activity = await payload.findByID({
    collection: 'activity',
    id: activityId,
    depth: 1,
    select: activityFormSelect,
    user: currentActor,
    overrideAccess: false,
  })
  return toActivityFormViewModel(activity as Activity)
}

export const loadActivityEditDraft = async (activityId: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return loadActivityEditDraftRecord(payload, actor, activityId)
}

export const cancelActivity = async (id: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return setActivityLifecycleStatusRecord(payload, actor, id, 'cancelado')
}

export const markActivityRealized = async (id: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return setActivityLifecycleStatusRecord(payload, actor, id, 'realizado')
}

export const toggleActivityTask = async (activityId: number, taskId: string, done: boolean) => {
  const { payload, actor } = await getCampaignActionContext()
  return toggleActivityTaskRecord(payload, actor, activityId, taskId, done)
}

export const appendActivityUpdate = async (activityId: number, body: string) => {
  const { payload, actor } = await getCampaignActionContext()
  return appendActivityUpdateRecord(payload, actor, activityId, body)
}

export const createTourDraftActivities = async (input: ParsedTourDraftFormData) => {
  const { payload, actor } = await getCampaignActionContext()
  return createTourDraftActivitiesRecord(payload, actor, input)
}

export const registerActivityResultAction = async (
  activityId: number,
  resultSummary: string,
  mediaIDs: number[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return registerActivityResult(payload, actor, activityId, resultSummary, mediaIDs)
}
