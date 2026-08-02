'use server'

import type { Payload } from 'payload'

import { assertCampaignDocCas } from '@/app/(campaign)/campanha/actions/assertCampaignDocCas'
import {
  CAMPAIGN_DEMAND_COST_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_EMPTY_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_SIZE_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_TYPE_MESSAGE,
  CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE,
} from '@/lib/schemas/campaignDemand'
import {
  campaignDemandCostSchema,
  campaignDemandCreateSchema,
  campaignDemandTransitionSchema,
  type CampaignDemandCostInput,
  type CampaignDemandCreateInput,
  type CampaignDemandTransitionInput,
} from '@/lib/schemas/campaignDemandInput'
import type { CampaignUser } from '@/payload-types'
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

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      // Access create rule validates municipality scope per role; the collection hook
      // links a leader's own leadership and enforces the initial status.
      return payload.create({
        collection: 'campaignDemand',
        data: hookFilledCreateData<'campaignDemand'>(data),
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da demanda.' },
  )
}

export const transitionCampaignDemandRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandTransitionInput,
  options?: { cas?: boolean },
) => {
  const { id, status, decisionNote, baseUpdatedAt } = campaignDemandTransitionSchema.parse(input)
  const enforceCas = options?.cas === true

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error(CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE)
      }
      await acquireTextAdvisoryLocks(payload, req, [`campaign-demand:${id}`])

      await assertCampaignDocCas(payload, {
        collection: 'campaignDemand',
        id,
        actor: currentActor,
        enforceCas,
        baseUpdatedAt,
        req,
      })

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

export const createCampaignDemand = async (input: CampaignDemandCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createCampaignDemandRecord(payload, actor, input)
}

export const transitionCampaignDemandCas = async (input: CampaignDemandTransitionInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return transitionCampaignDemandRecord(payload, actor, input, { cas: true })
}

export const transitionCampaignDemandCasRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CampaignDemandTransitionInput,
) => transitionCampaignDemandRecord(payload, actor, input, { cas: true })

export const setCampaignDemandCost = async (input: CampaignDemandCostInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setCampaignDemandCostRecord(payload, actor, input)
}
