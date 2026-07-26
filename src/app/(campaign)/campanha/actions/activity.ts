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
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

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

export const registerActivityResultAction = async (
  activityId: number,
  resultSummary: string,
  mediaIDs: number[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return registerActivityResult(payload, actor, activityId, resultSummary, mediaIDs)
}
