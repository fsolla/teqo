'use server'

import type { Payload } from 'payload'

import {
  actionPlanCreateSchema,
  actionPlanUpdateSchema,
  type ActionPlanCreateInput,
  type ActionPlanUpdateInput,
} from '@/lib/schemas/actionPlan'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const MAX_ACTION_PLAN_UPDATE_BODY_LENGTH = 4000

export const createActionPlanRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActionPlanCreateInput,
) => {
  const data = actionPlanCreateSchema.parse(input)

  return payload.create({
    collection: 'actionPlan',
    data: data as never,
    depth: 0,
    user: actor,
    overrideAccess: false,
  })
}

export const updateActionPlanRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ActionPlanUpdateInput,
) => {
  const { id, ...data } = actionPlanUpdateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      return payload.update({
        collection: 'actionPlan',
        id,
        data,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
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
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível registrar a atualização do plano.' },
  )
}

export const createActionPlan = async (input: ActionPlanCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createActionPlanRecord(payload, actor, input)
}

export const updateActionPlan = async (input: ActionPlanUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateActionPlanRecord(payload, actor, input)
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
