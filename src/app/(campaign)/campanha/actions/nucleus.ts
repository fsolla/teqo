'use server'

import type { Payload } from 'payload'

import {
  nucleusCreateSchema,
  nucleusUpdateSchema,
  type NucleusCreateInput,
  type NucleusUpdateInput,
} from '@/lib/schemas/nucleus'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { acquireNucleusRowLocks } from '@/utilities/nucleusRowLocks'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const createElectoralNucleus = async (
  payload: Payload,
  actor: CampaignUser,
  input: NucleusCreateInput,
) => {
  const data = nucleusCreateSchema.parse(input)

  return payload.create({
    collection: 'electoralNucleus',
    data: data as never,
    depth: 0,
    user: actor,
    overrideAccess: false,
  })
}

export const updateElectoralNucleus = async (
  payload: Payload,
  actor: CampaignUser,
  input: NucleusUpdateInput,
) => {
  const { id, ...data } = nucleusUpdateSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireNucleusRowLocks({ payload, ...req } as never, [id])

      return payload.update({
        collection: 'electoralNucleus',
        id,
        data,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização do núcleo.' },
  )
}

export const archiveElectoralNucleus = async (
  payload: Payload,
  actor: CampaignUser,
  id: number,
) => {
  const currentActor = await reloadCampaignActor(payload, actor)

  if (currentActor.role !== 'geral') {
    throw new Error('Somente a coordenação geral pode arquivar núcleos.')
  }

  return payload.update({
    collection: 'electoralNucleus',
    id,
    data: {
      status: 'arquivado',
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const createNucleus = async (input: NucleusCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createElectoralNucleus(payload, actor, input)
}

export const updateNucleus = async (input: NucleusUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateElectoralNucleus(payload, actor, input)
}

export const archiveNucleus = async (id: number) => {
  const { payload, actor } = await getCampaignActionContext()
  return archiveElectoralNucleus(payload, actor, id)
}
