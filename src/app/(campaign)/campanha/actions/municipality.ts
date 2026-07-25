'use server'

import type { Payload } from 'payload'

import {
  municipalityAdvisorsAssignmentSchema,
  municipalityExpectedVotesSchema,
  municipalityPoliticalTrendSchema,
  municipalityStrategyUpdateSchema,
  type MunicipalityAdvisorsAssignmentInput,
  type MunicipalityExpectedVotesInput,
  type MunicipalityPoliticalTrendInput,
  type MunicipalityStrategyUpdateInput,
} from '@/lib/schemas/municipality'
import type { CampaignUser } from '@/payload-types'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import {
  normalizeVoteEstimateOnSave,
  toVoteEstimateScenarioViewModel,
} from '@/utilities/voteEstimate'

const getFreshStaffActor = (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> =>
  reloadStaffActor(
    payload,
    actor,
    'Somente a coordenação e a assessoria podem editar o município.',
    req,
  )

/** Staff strategy fields: priority and intel notes. Access enforced by row scope. */
export const updateMunicipalityStrategyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityStrategyUpdateInput,
) => {
  const { municipality, strengths, risks, stateDeputies, ...fields } =
    municipalityStrategyUpdateSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'municipality',
    id: municipality,
    data: {
      ...fields,
      ...(strengths === undefined ? {} : { strengths: strengths.map((text) => ({ text })) }),
      ...(risks === undefined ? {} : { risks: risks.map((text) => ({ text })) }),
      ...(stateDeputies === undefined ? {} : { stateDeputies }),
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const updateMunicipalityStrategy = async (input: MunicipalityStrategyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateMunicipalityStrategyRecord(payload, actor, input)
}

/** Political trend: manual conjuncture reading by staff (author/date derived by hook). */
export const setMunicipalityPoliticalTrendRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityPoliticalTrendInput,
) => {
  const { municipality, status, note } = municipalityPoliticalTrendSchema.parse(input)
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'municipality',
    id: municipality,
    data: {
      politicalTrend: { status, note },
    },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const setMunicipalityPoliticalTrend = async (input: MunicipalityPoliticalTrendInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setMunicipalityPoliticalTrendRecord(payload, actor, input)
}

/** Staff-only total expected votes for the municipality (distinct from pledge aggregates). */
export const setMunicipalityExpectedVotesRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityExpectedVotesInput,
) => {
  const normalizedExpectedVotes = normalizeVoteEstimateOnSave(
    toVoteEstimateScenarioViewModel(input.expectedVotes),
  )
  const { municipality, expectedVotes } = municipalityExpectedVotesSchema.parse({
    municipality: input.municipality,
    expectedVotes: normalizedExpectedVotes,
  })
  const currentActor = await getFreshStaffActor(payload, actor)

  return payload.update({
    collection: 'municipality',
    id: municipality,
    data: { expectedVotes },
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const setMunicipalityExpectedVotes = async (input: MunicipalityExpectedVotesInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setMunicipalityExpectedVotesRecord(payload, actor, input)
}

/** Advisor assignment is unrestricted staff (coordinator + candidate); the hook validates eligibility. */
export const assignMunicipalityAdvisorsRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityAdvisorsAssignmentInput,
) => {
  const { municipality, advisors } = municipalityAdvisorsAssignmentSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      await reloadUnrestrictedActor(
        payload,
        actor,
        'Somente a coordenação geral ou o candidato designa assessores.',
        req,
      )

      await acquireTextAdvisoryLocks(payload, req, [`municipality-advisors:${municipality}`])

      // Intentional admin bypass: unrestricted role was freshly verified above;
      // the advisors field is admin-only by field access.
      return payload.update({
        collection: 'municipality',
        id: municipality,
        data: { advisors },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a designação de assessores.' },
  )
}

export const assignMunicipalityAdvisors = async (input: MunicipalityAdvisorsAssignmentInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return assignMunicipalityAdvisorsRecord(payload, actor, input)
}
