'use server'

import type { Payload } from 'payload'

import {
  nucleusUpdateCreateSchema,
  type NucleusUpdateCreateInput,
} from '@/lib/schemas/nucleusUpdate'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const createNucleusUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: NucleusUpdateCreateInput,
) => {
  const data = nucleusUpdateCreateSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      return payload.create({
        collection: 'nucleusUpdate',
        data: data as never,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação da atualização.' },
  )
}

export const listNucleusUpdates = async (
  payload: Payload,
  actor: CampaignUser,
  nucleus: number,
) => {
  const currentActor = await reloadCampaignActor(payload, actor)
  await payload.findByID({
    collection: 'electoralNucleus',
    id: nucleus,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })

  return payload.find({
    collection: 'nucleusUpdate',
    where: { nucleus: { equals: nucleus } },
    depth: 1,
    sort: '-createdAt',
    user: currentActor,
    overrideAccess: false,
  })
}

export const createNucleusUpdate = async (input: NucleusUpdateCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createNucleusUpdateRecord(payload, actor, input)
}
