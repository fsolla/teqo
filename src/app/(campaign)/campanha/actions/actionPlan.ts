'use server'

import type { Payload } from 'payload'

import {
  actionPlanCreateSchema,
  actionPlanDemandDraftsSchema,
  actionPlanUpdateSchema,
  type ActionPlanDemandDraft,
  type ActionPlanCreateInput,
  type ActionPlanUpdateInput,
} from '@/lib/schemas/actionPlan'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

const MAX_ACTION_PLAN_UPDATE_BODY_LENGTH = 4000
const MAX_ACTION_PLAN_RESULT_SUMMARY_LENGTH = 6000

export const createActionPlanRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActionPlanCreateInput,
  demandDrafts: ActionPlanDemandDraft[] = [],
) => {
  const data = actionPlanCreateSchema.parse(input)
  const demands = actionPlanDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      const plan = await payload.create({
        collection: 'actionPlan',
        data: hookFilledCreateData<'actionPlan'>(data),
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
            actionPlan: plan.id,
          }),
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return plan
    },
    { beginFailureMessage: 'Não foi possível iniciar a criação do plano.' },
  )
}

export const updateActionPlanRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActionPlanUpdateInput,
  demandDrafts: ActionPlanDemandDraft[] = [],
) => {
  const { id, ...data } = actionPlanUpdateSchema.parse(input)
  const demands = actionPlanDemandDraftsSchema.parse(demandDrafts)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      const plan = await payload.update({
        collection: 'actionPlan',
        id,
        data,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const municipality =
        typeof plan.municipality === 'number' ? plan.municipality : plan.municipality.id
      for (const demand of demands) {
        await payload.create({
          collection: 'campaignDemand',
          data: hookFilledCreateData<'campaignDemand'>({
            ...demand,
            municipality,
            actionPlan: plan.id,
          }),
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return plan
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização do plano.' },
  )
}

const setActionPlanLifecycleStatusRecord = async (
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
        collection: 'actionPlan',
        id,
        data: { status },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível atualizar o status do plano.' },
  )

export const toggleActionPlanTaskRecord = async (
  payload: Payload,
  actor: CampaignUser,
  planId: number,
  taskId: string,
  done: boolean,
) =>
  withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`action-plan:${planId}`])
      const plan = await payload.findByID({
        collection: 'actionPlan',
        id: planId,
        depth: 0,
        select: { tasks: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const tasks = plan.tasks ?? []
      const taskIndex = tasks.findIndex((task) => task.id === taskId)
      if (taskIndex === -1) throw new Error('Tarefa não encontrada.')

      const nextTasks = tasks.map((task, index) => (index === taskIndex ? { ...task, done } : task))

      return payload.update({
        collection: 'actionPlan',
        id: planId,
        data: { tasks: nextTasks },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'taskToggle' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível atualizar a tarefa do plano.' },
  )

export const appendActionPlanUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  planId: number,
  body: string,
) => {
  const trimmedBody = body.trim()
  if (!trimmedBody) throw new Error('Informe o texto da atualização.')
  if (trimmedBody.length > MAX_ACTION_PLAN_UPDATE_BODY_LENGTH) {
    throw new Error('Atualização muito longa. Reduza o texto e tente novamente.')
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, [`action-plan:${planId}`])
      const plan = await payload.findByID({
        collection: 'actionPlan',
        id: planId,
        depth: 0,
        select: { updates: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const updates = plan.updates ?? []
      const nextUpdates = [...updates, { body: trimmedBody }]

      return payload.update({
        collection: 'actionPlan',
        id: planId,
        data: { updates: nextUpdates },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'appendUpdate' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível registrar a atualização do plano.' },
  )
}

export const registerActionPlanResult = async (
  payload: Payload,
  actor: CampaignUser,
  planId: number,
  resultSummary: string,
  mediaIDs: number[],
) => {
  const trimmedSummary = resultSummary.trim()
  if (!trimmedSummary) throw new Error('Informe o resultado da ação.')
  if (trimmedSummary.length > MAX_ACTION_PLAN_RESULT_SUMMARY_LENGTH) {
    throw new Error('Resultado muito longo. Reduza o texto e tente novamente.')
  }

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error('Apenas a equipe da campanha pode registrar o resultado do plano.')
      }

      return payload.update({
        collection: 'actionPlan',
        id: planId,
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
    { beginFailureMessage: 'Não foi possível registrar o resultado do plano.' },
  )
}

export const createActionPlan = async (
  input: ActionPlanCreateInput,
  demandDrafts: ActionPlanDemandDraft[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return createActionPlanRecord(payload, actor, input, demandDrafts)
}

export const updateActionPlan = async (
  input: ActionPlanUpdateInput,
  demandDrafts: ActionPlanDemandDraft[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateActionPlanRecord(payload, actor, input, demandDrafts)
}

export const cancelActionPlan = async (id: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return setActionPlanLifecycleStatusRecord(payload, actor, id, 'cancelado')
}

export const markActionPlanRealized = async (id: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return setActionPlanLifecycleStatusRecord(payload, actor, id, 'realizado')
}

export const toggleActionPlanTask = async (planId: number, taskId: string, done: boolean) => {
  const { payload, actor } = await getCampaignActionContext()
  return toggleActionPlanTaskRecord(payload, actor, planId, taskId, done)
}

export const appendActionPlanUpdate = async (planId: number, body: string) => {
  const { payload, actor } = await getCampaignActionContext()
  return appendActionPlanUpdateRecord(payload, actor, planId, body)
}

export const registerActionPlanResultAction = async (
  planId: number,
  resultSummary: string,
  mediaIDs: number[] = [],
) => {
  const { payload, actor } = await getCampaignActionContext()
  return registerActionPlanResult(payload, actor, planId, resultSummary, mediaIDs)
}
