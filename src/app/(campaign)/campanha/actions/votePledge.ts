'use server'

import type { Payload } from 'payload'

import {
  declareVotesSchema,
  estimateVotesSchema,
  type DeclareVotesInput,
  type EstimateVotesInput,
} from '@/lib/schemas/votePledge'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'
import {
  normalizeVoteEstimateOnSave,
  toVoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

const OWN_ENGAGED_LEADERSHIP_REQUIRED = 'Somente lideranças engajadas podem declarar votos.'
const PLAZA_NOT_LINKED = 'A liderança precisa estar vinculada à Praça para declarar votos nela.'

/**
 * Declare (or update) the votes a leadership is bringing in one plaza.
 * A leader always declares for their own leadership; staff may declare on
 * behalf of any leadership in their scope.
 */
export const declareVotesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: DeclareVotesInput,
) => {
  const data = declareVotesSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      let leadershipID: number
      if (currentActor.role === 'leader') {
        const ownLeadership = await payload.find({
          collection: 'leadership',
          where: {
            and: [{ user: { equals: currentActor.id } }, { supportStatus: { equals: 'engajado' } }],
          },
          depth: 0,
          limit: 1,
          pagination: false,
          overrideAccess: true,
          req,
        })
        const leadership = ownLeadership.docs[0]
        if (!leadership) throw new Error(OWN_ENGAGED_LEADERSHIP_REQUIRED)
        leadershipID = leadership.id

        const linkedPlazaIDs = (leadership.plazas ?? [])
          .map(relationshipId)
          .filter((id): id is number => id !== null)
        if (!linkedPlazaIDs.includes(data.plaza)) throw new Error(PLAZA_NOT_LINKED)
      } else {
        if (!data.leadership) throw new Error('Informe a liderança da declaração.')
        leadershipID = data.leadership
        // Row access on the plaza read verifies the staff scope (advisor only
        // reaches administered plazas).
        await payload.findByID({
          collection: 'plaza',
          id: data.plaza,
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      await acquireTextAdvisoryLocks(payload, req, [`vote-pledge:${leadershipID}:${data.plaza}`])

      const existing = await payload.find({
        collection: 'votePledge',
        where: {
          and: [{ leadership: { equals: leadershipID } }, { plaza: { equals: data.plaza } }],
        },
        depth: 0,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        req,
      })
      const current = existing.docs[0]

      if (current) {
        return payload.update({
          collection: 'votePledge',
          id: current.id,
          data: { declaredVotes: data.declaredVotes },
          depth: 0,
          user: currentActor,
          overrideAccess: false,
          req,
        })
      }

      return payload.create({
        collection: 'votePledge',
        data: {
          leadership: leadershipID,
          plaza: data.plaza,
          declaredVotes: data.declaredVotes,
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a declaração de votos.' },
  )
}

export const declareVotes = async (input: DeclareVotesInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return declareVotesRecord(payload, actor, input)
}

/** Staff estimate of the real value — never visible to the leadership. */
export const estimateVotesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: EstimateVotesInput,
) => {
  const data = estimateVotesSchema.parse({
    ...input,
    estimatedVotes: normalizeVoteEstimateOnSave(
      toVoteEstimateScenarioViewModel(input.estimatedVotes),
    ),
  })

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (currentActor.role !== 'coordinator' && currentActor.role !== 'advisor') {
        throw new Error('Somente a coordenação e a assessoria registram estimativas.')
      }

      // Row access scopes the pledge to the actor (advisor: administered plazas).
      const pledge = await payload.findByID({
        collection: 'votePledge',
        id: data.pledge,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      await acquireTextAdvisoryLocks(payload, req, [
        `vote-pledge:${requireRelationshipId(pledge.leadership)}:${requireRelationshipId(pledge.plaza)}`,
      ])

      return payload.update({
        collection: 'votePledge',
        id: pledge.id,
        data: {
          estimatedVotes: data.estimatedVotes,
          estimateNote: data.estimateNote,
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da estimativa.' },
  )
}

export const estimateVotes = async (input: EstimateVotesInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return estimateVotesRecord(payload, actor, input)
}
