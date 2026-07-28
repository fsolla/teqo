'use server'

import type { Payload } from 'payload'

import {
  activityCreateSchema,
  activityDemandDraftsSchema,
  activityUpdateSchema,
  type ActivityCreateInput,
  type ActivityDemandDraft,
  type ActivityUpdateInput,
} from '@/lib/schemas/activity'
import type { CampaignUser } from '@/payload-types'
import type { ParsedTourDraftFormData } from '@/utilities/activityFormData'
import { isCampaignStaff } from '@/utilities/campaignAccess'
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
} from '@/utilities/visitPlannerViews'

const MAX_ACTIVITY_UPDATE_BODY_LENGTH = 4000
const MAX_ACTIVITY_RESULT_SUMMARY_LENGTH = 6000

export const createActivityRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActivityCreateInput,
  demandDrafts: ActivityDemandDraft[] = [],
) => {
  const data = activityCreateSchema.parse(input)
  const demands = activityDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
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
            municipality: data.municipality,
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

      // The names come from the same read that authorized the stops, so a stop's
      // title always names the município it was actually created in, and the
      // giro reads as one set in the Atividades list.
      const nameByID = new Map(readable.docs.map((doc) => [doc.id, doc.name]))

      const created = []
      for (const stop of stops) {
        const data = activityCreateSchema.parse({
          ...stop,
          title: `${tourName} — ${nameByID.get(stop.municipality)}`,
          status: 'rascunho',
          // The whole point of the planner: these drafts are the candidate's agenda.
          deputyPresent: true,
          ...(note ? { description: note } : {}),
        })

        created.push(
          await payload.create({
            collection: 'activity',
            data: hookFilledCreateData<'activity'>(data),
            depth: 0,
            user: currentActor,
            overrideAccess: false,
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
  const { id, ...data } = activityUpdateSchema.parse(input)
  const demands = activityDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      const activity = await payload.update({
        collection: 'activity',
        id,
        data,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

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
      if (taskIndex === -1) throw new Error('Tarefa não encontrada.')

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
  if (!trimmedBody) throw new Error('Informe o texto da atualização.')
  if (trimmedBody.length > MAX_ACTIVITY_UPDATE_BODY_LENGTH) {
    throw new Error('Atualização muito longa. Reduza o texto e tente novamente.')
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
  if (!trimmedSummary) throw new Error('Informe o resultado da atividade.')
  if (trimmedSummary.length > MAX_ACTIVITY_RESULT_SUMMARY_LENGTH) {
    throw new Error('Resultado muito longo. Reduza o texto e tente novamente.')
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error('Apenas a equipe da campanha pode registrar o resultado da atividade.')
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

export const createActivity = async (
  input: ActivityCreateInput,
  demandDrafts: ActivityDemandDraft[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return createActivityRecord(payload, actor, input, demandDrafts)
}

export const updateActivity = async (
  input: ActivityUpdateInput,
  demandDrafts: ActivityDemandDraft[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateActivityRecord(payload, actor, input, demandDrafts)
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
