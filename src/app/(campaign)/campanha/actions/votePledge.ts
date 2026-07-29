'use server'

import type { Payload } from 'payload'

import { relationshipId, requireRelationshipId } from '@/lib/relationship'
import {
  declareVotesSchema,
  estimateVotesSchema,
  VOTE_PLEDGE_DECLARE_STAFF_MESSAGE,
  VOTE_PLEDGE_ESTIMATE_STAFF_MESSAGE,
  VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE,
  VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE,
  type DeclareVotesInput,
  type EstimateVotesInput,
} from '@/lib/schemas/votePledge'
import { normalizeVoteEstimateOnSave, toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

/**
 * Declare (or update) the votes a leadership is bringing in one municipality.
 * Staff-only — leaders no longer declare through the app.
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

      if (!isCampaignStaff(currentActor)) {
        throw new Error(VOTE_PLEDGE_DECLARE_STAFF_MESSAGE)
      }

      if (!data.leadership) throw new Error(VOTE_PLEDGE_LEADERSHIP_REQUIRED_MESSAGE)
      const leadershipID = data.leadership

      const leadership = await payload.findByID({
        collection: 'leadership',
        id: leadershipID,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const linkedMunicipalityIDs = (leadership.municipalities ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
      if (!linkedMunicipalityIDs.includes(data.municipality)) {
        throw new Error(VOTE_PLEDGE_MUNICIPALITY_NOT_LINKED_MESSAGE)
      }

      await payload.findByID({
        collection: 'municipality',
        id: data.municipality,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      await acquireTextAdvisoryLocks(payload, req, [
        `vote-pledge:${leadershipID}:${data.municipality}`,
      ])

      const existing = await payload.find({
        collection: 'votePledge',
        where: {
          and: [
            { leadership: { equals: leadershipID } },
            { municipality: { equals: data.municipality } },
          ],
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
          municipality: data.municipality,
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
      if (!isCampaignStaff(currentActor)) {
        throw new Error(VOTE_PLEDGE_ESTIMATE_STAFF_MESSAGE)
      }

      // Row access scopes the pledge to the actor (advisor: administered municipalities).
      const pledge = await payload.findByID({
        collection: 'votePledge',
        id: data.pledge,
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      await acquireTextAdvisoryLocks(payload, req, [
        `vote-pledge:${requireRelationshipId(pledge.leadership)}:${requireRelationshipId(pledge.municipality)}`,
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
