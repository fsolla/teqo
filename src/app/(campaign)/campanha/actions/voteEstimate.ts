'use server'

import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'

import {
  confirmVoteEstimateSchema,
  suggestVoteEstimateSchema,
  type ConfirmVoteEstimateInput,
  type SuggestVoteEstimateInput,
} from '@/lib/schemas/voteEstimate'
import type { CampaignUser, ElectoralNucleus } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const assertSuggestionScope = async (
  payload: Payload,
  actor: CampaignUser,
  nucleus: number,
  req: PayloadTransactionRequest,
): Promise<void> => {
  if (actor.role === 'geral') return

  if (actor.role === 'coordenador') {
    await payload.findByID({
      collection: 'electoralNucleus',
      id: nucleus,
      depth: 0,
      user: actor,
      overrideAccess: false,
      req,
    })
    return
  }

  const links = await payload.find({
    collection: 'leadership',
    where: {
      and: [
        { nucleus: { equals: nucleus } },
        { user: { equals: actor.id } },
        { supportStatus: { equals: 'engajado' } },
      ],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
  })

  if (links.totalDocs === 0) {
    throw new Error('A liderança precisa de vínculo engajado com este núcleo.')
  }
}

const getConfirmableNucleus = async (
  payload: Payload,
  actor: CampaignUser,
  nucleus: number,
  req: PayloadTransactionRequest,
): Promise<ElectoralNucleus> => {
  if (actor.role !== 'geral' && actor.role !== 'coordenador') {
    throw new Error('Somente a coordenação pode confirmar estimativas.')
  }

  return payload.findByID({
    collection: 'electoralNucleus',
    id: nucleus,
    depth: 0,
    user: actor,
    overrideAccess: false,
    req,
  })
}

export const suggestVoteEstimateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: SuggestVoteEstimateInput,
) => {
  const data = suggestVoteEstimateSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      if (payload.db.name !== 'postgres') {
        throw new Error('O bloqueio de estimativa exige o adaptador PostgreSQL.')
      }
      await acquireTextAdvisoryLocks(payload, req, [`vote-estimate:${data.nucleus}`])
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await assertSuggestionScope(payload, currentActor, data.nucleus, req)

      // Intentional admin bypass: scope was checked under the nucleus transaction lock; audit
      // fields and proposal version are derived exclusively on the server.
      return payload.update({
        collection: 'electoralNucleus',
        id: data.nucleus,
        data: {
          proposedVoteEstimate: data.estimate,
          proposedVoteEstimateAt: new Date().toISOString(),
          proposedVoteEstimateBy: currentActor.id,
          proposedVoteEstimateVersion: randomUUID(),
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação da estimativa.' },
  )
}

export const confirmVoteEstimateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ConfirmVoteEstimateInput,
) => {
  const data = confirmVoteEstimateSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      if (payload.db.name !== 'postgres') {
        throw new Error('O bloqueio de estimativa exige o adaptador PostgreSQL.')
      }
      await acquireTextAdvisoryLocks(payload, req, [`vote-estimate:${data.nucleus}`])
      const currentActor = await reloadCampaignActor(payload, actor, req)
      const nucleus = await getConfirmableNucleus(payload, currentActor, data.nucleus, req)
      const proposal = nucleus.proposedVoteEstimate
      const proposalVersion = nucleus.proposedVoteEstimateVersion ?? null

      if (proposal == null) {
        if (proposalVersion !== null || data.expectedProposedVoteEstimateVersion !== null) {
          throw new Error('A sugestão foi alterada. Atualize a página antes de confirmar.')
        }
      } else if (
        proposalVersion === null ||
        proposalVersion !== data.expectedProposedVoteEstimateVersion
      ) {
        throw new Error('A sugestão foi alterada. Atualize a página antes de confirmar.')
      }
      if ((proposal == null || data.estimate !== proposal) && !data.confirmationNote) {
        throw new Error('Informe uma justificativa para ajustar a estimativa.')
      }

      // Intentional admin bypass: confirmation role/scope and proposal revision were checked
      // under the same transaction lock; all audit fields are server-derived.
      return payload.update({
        collection: 'electoralNucleus',
        id: data.nucleus,
        data: {
          confirmedVoteEstimate: data.estimate,
          confirmedVoteEstimateAt: new Date().toISOString(),
          confirmedVoteEstimateBy: currentActor.id,
          confirmationNote: data.confirmationNote ?? null,
          proposedVoteEstimate: null,
          proposedVoteEstimateAt: null,
          proposedVoteEstimateBy: null,
          proposedVoteEstimateVersion: null,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação da estimativa.' },
  )
}

export const suggestVoteEstimate = async (input: SuggestVoteEstimateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return suggestVoteEstimateRecord(payload, actor, input)
}

export const confirmVoteEstimate = async (input: ConfirmVoteEstimateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return confirmVoteEstimateRecord(payload, actor, input)
}
