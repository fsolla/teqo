'use server'

import type { Payload } from 'payload'

import { fallbackDemandTitle } from '@/lib/demandTitle'
import type { CampaignDemandKind } from '@/lib/schemas/campaignDemand'
import {
  CAMPAIGN_DEMAND_COST_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_EDIT_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_EMPTY_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_SIZE_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_TYPE_MESSAGE,
  CAMPAIGN_DEMAND_RESPONSIBLES_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE,
} from '@/lib/schemas/campaignDemand'
import {
  campaignDemandCostSchema,
  campaignDemandCreateSchema,
  campaignDemandResponsiblesSchema,
  campaignDemandTransitionSchema,
  campaignDemandUpdateSchema,
  type CampaignDemandCostInput,
  type CampaignDemandCreateInput,
  type CampaignDemandResponsiblesInput,
  type CampaignDemandTransitionInput,
  type CampaignDemandUpdateInput,
} from '@/lib/schemas/campaignDemandInput'
import type { CampaignUser } from '@/payload-types'
import { deriveDemandTitle } from '@/utilities/ai/campaignDemandTitle'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  getCampaignActionContext,
  reloadCampaignActor,
  reloadStaffActor,
} from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

export const createCampaignDemandRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandCreateInput,
) => {
  const data = campaignDemandCreateSchema.parse(input)
  // AI call BEFORE the transaction opens: a slow model never holds the
  // transaction or its advisory locks, and creating never fails on the AI
  // (missing key / timeout / unusable output → truncated-title fallback).
  const title =
    (await deriveDemandTitle(data.description, data.kind)) ?? fallbackDemandTitle(data.description)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      // Opt in to slug uniquification for form-created demands: the AI-derived
      // title may collide across municipalities and a duplicate must not fail
      // the create (the hook honors the flag only inside this transaction).
      return payload.create({
        collection: 'campaignDemand',
        data: hookFilledCreateData<'campaignDemand'>({ ...data, title }),
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
        context: { campaignDemandUniqueSlug: true },
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da demanda.' },
  )
}

export const updateCampaignDemandRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandUpdateInput,
) => {
  const { id, description } = campaignDemandUpdateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(CAMPAIGN_DEMAND_EDIT_STAFF_MESSAGE)
      }

      // Access-scoped read (C143: responsibles + unrestricted see the demand).
      // The AI call stays before the advisory lock, so the lock is never held
      // open by it.
      const demand = await payload.findByID({
        collection: 'campaignDemand',
        id,
        depth: 0,
        select: { title: true, kind: true, description: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      // Re-derive the title only when the free text actually changed; on AI
      // failure the previous title is kept (fallback by truncation is a
      // create-only policy). The slug is preserved by the collection hook.
      const derived =
        (demand.description ?? '') === description
          ? null
          : await deriveDemandTitle(description, demand.kind as CampaignDemandKind)

      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${id}`])

      return payload.update({
        collection: 'campaignDemand',
        id,
        data: {
          description,
          ...(derived ? { title: derived } : {}),
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a edição da demanda.' },
  )
}

export const transitionCampaignDemandRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandTransitionInput,
) => {
  const { id, status, decisionNote } = campaignDemandTransitionSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE)
      }
      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${id}`])

      // Transition validity + coordinator-only escalated decisions are
      // enforced by the collection hook.
      return payload.update({
        collection: 'campaignDemand',
        id,
        data: {
          status,
          ...(decisionNote === undefined ? {} : { decisionNote }),
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transição da demanda.' },
  )
}

export const setCampaignDemandCostRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandCostInput,
) => {
  const { id, cost } = campaignDemandCostSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(CAMPAIGN_DEMAND_COST_STAFF_MESSAGE)
      }
      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${id}`])

      return payload.update({
        collection: 'campaignDemand',
        id,
        data: { cost },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro do custo.' },
  )
}

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024
const RECEIPT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

export const attachCampaignDemandReceiptRecord = async (
  payload: Payload,
  actor: CampaignUser,
  demandID: number,
  file: File,
) => {
  if (!RECEIPT_MIME_TYPES.has(file.type)) {
    throw new Error(CAMPAIGN_DEMAND_RECEIPT_TYPE_MESSAGE)
  }
  if (file.size === 0) throw new Error(CAMPAIGN_DEMAND_RECEIPT_EMPTY_MESSAGE)
  if (file.size > RECEIPT_MAX_BYTES) throw new Error(CAMPAIGN_DEMAND_RECEIPT_SIZE_MESSAGE)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(
        payload,
        actor,
        CAMPAIGN_DEMAND_RECEIPT_STAFF_MESSAGE,
        req,
      )
      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${demandID}`])

      // Row access verifies the demand is in the actor's scope before writing.
      const demand = await payload.findByID({
        collection: 'campaignDemand',
        id: demandID,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      // Intentional admin bypass: media creation for a receipt the actor may attach.
      const media = await payload.create({
        collection: 'media',
        data: { alt: `Comprovante — ${demand.title}` },
        file: {
          data: Buffer.from(await file.arrayBuffer()),
          mimetype: file.type,
          name: file.name,
          size: file.size,
        },
        overrideAccess: true,
        req,
      })

      const currentReceipts = (demand.receipts ?? []).map((receipt) =>
        typeof receipt === 'object' && receipt !== null ? receipt.id : receipt,
      )

      return payload.update({
        collection: 'campaignDemand',
        id: demandID,
        data: { receipts: [...currentReceipts, media.id] },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o anexo do comprovante.' },
  )
}

export const setCampaignDemandResponsiblesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandResponsiblesInput,
) => {
  const { id, responsibles } = campaignDemandResponsiblesSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(CAMPAIGN_DEMAND_RESPONSIBLES_STAFF_MESSAGE)
      }
      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${id}`])

      // Access-scoped read (responsibles + unrestricted see it) before the
      // replace, so an advisor cannot manage a demand they cannot read.
      await payload.findByID({
        collection: 'campaignDemand',
        id,
        depth: 0,
        select: { title: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      return payload.update({
        collection: 'campaignDemand',
        id,
        data: { responsibles: [...new Set(responsibles)] },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização dos responsáveis.' },
  )
}

export const createCampaignDemand = async (input: CampaignDemandCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createCampaignDemandRecord(payload, actor, input)
}

export const updateCampaignDemand = async (input: CampaignDemandUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateCampaignDemandRecord(payload, actor, input)
}

export const transitionCampaignDemand = async (input: CampaignDemandTransitionInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return transitionCampaignDemandRecord(payload, actor, input)
}

export const setCampaignDemandCost = async (input: CampaignDemandCostInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setCampaignDemandCostRecord(payload, actor, input)
}

export const setCampaignDemandResponsibles = async (input: CampaignDemandResponsiblesInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setCampaignDemandResponsiblesRecord(payload, actor, input)
}
