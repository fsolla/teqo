'use server'

import type { Payload } from 'payload'

import {
  plazaAdvisorsAssignmentSchema,
  plazaExpectedVotesSchema,
  plazaPoliticalTrendSchema,
  plazaStrategyUpdateSchema,
  type PlazaAdvisorsAssignmentInput,
  type PlazaExpectedVotesInput,
  type PlazaPoliticalTrendInput,
  type PlazaStrategyUpdateInput,
} from '@/lib/schemas/plaza'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  normalizeVoteEstimateOnSave,
  toVoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

const getFreshStaffActor = async (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)

  if (currentActor.role !== 'coordinator' && currentActor.role !== 'advisor') {
    throw new Error('Somente a coordenação e a assessoria podem editar a Praça.')
  }

  return currentActor
}

/** Staff strategy fields: goals, priority, intel notes. Access enforced by row scope. */
export const updatePlazaStrategyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PlazaStrategyUpdateInput,
) => {
  const { plaza, strengths, risks, ...fields } = plazaStrategyUpdateSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'plaza',
    id: plaza,
    data: {
      ...fields,
      ...(strengths === undefined ? {} : { strengths: strengths.map((text) => ({ text })) }),
      ...(risks === undefined ? {} : { risks: risks.map((text) => ({ text })) }),
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const updatePlazaStrategy = async (input: PlazaStrategyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updatePlazaStrategyRecord(payload, actor, input)
}

/** Political trend: manual conjuncture reading by staff (author/date derived by hook). */
export const setPlazaPoliticalTrendRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PlazaPoliticalTrendInput,
) => {
  const { plaza, status, note } = plazaPoliticalTrendSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'plaza',
    id: plaza,
    data: {
      politicalTrend: { status, note },
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const setPlazaPoliticalTrend = async (input: PlazaPoliticalTrendInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setPlazaPoliticalTrendRecord(payload, actor, input)
}

/** Staff-only total expected votes for the plaza (distinct from pledge aggregates). */
export const setPlazaExpectedVotesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PlazaExpectedVotesInput,
) => {
  const normalizedExpectedVotes = normalizeVoteEstimateOnSave(
    toVoteEstimateScenarioViewModel(input.expectedVotes),
  )
  const { plaza, expectedVotes } = plazaExpectedVotesSchema.parse({
    plaza: input.plaza,
    expectedVotes: normalizedExpectedVotes,
  })
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'plaza',
    id: plaza,
    data: { expectedVotes },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const setPlazaExpectedVotes = async (input: PlazaExpectedVotesInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setPlazaExpectedVotesRecord(payload, actor, input)
}

/** Advisor assignment is coordinator-only; the collection hook validates eligibility. */
export const assignPlazaAdvisorsRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: PlazaAdvisorsAssignmentInput,
) => {
  const { plaza, advisors } = plazaAdvisorsAssignmentSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (currentActor.role !== 'coordinator') {
        throw new Error('Somente o Coordenador Geral designa assessores.')
      }

      await acquireTextAdvisoryLocks(payload, req, [`plaza-advisors:${plaza}`])

      // Intentional admin bypass: coordinator role was freshly verified above;
      // the advisors field is admin-only by field access.
      return payload.update({
        collection: 'plaza',
        id: plaza,
        data: { advisors },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a designação de assessores.' },
  )
}

export const assignPlazaAdvisors = async (input: PlazaAdvisorsAssignmentInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return assignPlazaAdvisorsRecord(payload, actor, input)
}
