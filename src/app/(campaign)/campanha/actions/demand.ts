'use server'

import type { Payload } from 'payload'

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
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

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
) => {
  const { id, status, decisionNote } = campaignDemandTransitionSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (!isCampaignStaff(currentActor)) {
        throw new Error('Somente a coordenação, a assessoria e o candidato movem demandas.')
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
        throw new Error('Somente a coordenação, a assessoria e o candidato registram custos.')
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
    throw new Error('Envie uma imagem (JPEG, PNG, WebP) ou PDF.')
  }
  if (file.size === 0) throw new Error('O arquivo enviado está vazio.')
  if (file.size > RECEIPT_MAX_BYTES) throw new Error('O comprovante deve ter no máximo 10 MB.')

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadStaffActor(
        payload,
        actor,
        'Somente a coordenação e a assessoria anexam comprovantes.',
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

export const transitionCampaignDemand = async (input: CampaignDemandTransitionInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return transitionCampaignDemandRecord(payload, actor, input)
}

export const setCampaignDemandCost = async (input: CampaignDemandCostInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setCampaignDemandCostRecord(payload, actor, input)
}
