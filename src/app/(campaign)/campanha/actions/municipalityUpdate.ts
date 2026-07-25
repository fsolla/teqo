'use server'

import type { Payload } from 'payload'

import {
  municipalityUpdateCreateSchema,
  type MunicipalityUpdateCreateInput,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const createMunicipalityUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityUpdateCreateInput,
) => {
  const data = municipalityUpdateCreateSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      return payload.create({
        collection: 'municipalityUpdate',
        data: hookFilledCreateData<'municipalityUpdate'>(data),
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da atualização.' },
  )
}

export const createMunicipalityUpdate = async (input: MunicipalityUpdateCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createMunicipalityUpdateRecord(payload, actor, input)
}
