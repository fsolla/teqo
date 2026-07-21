'use server'

import type { Payload } from 'payload'

import { plazaUpdateCreateSchema, type PlazaUpdateCreateInput } from '@/lib/schemas/plazaUpdate'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const createPlazaUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PlazaUpdateCreateInput,
) => {
  const data = plazaUpdateCreateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      return payload.create({
        collection: 'plazaUpdate',
        data: data as never,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da atualização.' },
  )
}

export const createPlazaUpdate = async (input: PlazaUpdateCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createPlazaUpdateRecord(payload, actor, input)
}
