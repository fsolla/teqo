'use server'

import type { Payload } from 'payload'

import {
  ENGAGEMENT_LEVEL_PATTERN_ID,
  EngagementLevelBlockedError,
  getEngagementLevelViolations,
} from '@/lib/engagementLevel'
import { nextAdvisorIdsAfterMembership } from '@/lib/municipalityAdvisorMembership'
import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
  MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE,
  municipalityAdvisorMembershipSchema,
  municipalityAdvisorsAssignmentSchema,
  municipalityEngagementLevelSchema,
  municipalityExpectedVotesSchema,
  municipalityPoliticalTrendSchema,
  municipalityStrategyUpdateSchema,
  type MunicipalityAdvisorMembershipInput,
  type MunicipalityAdvisorsAssignmentInput,
  type MunicipalityEngagementLevelInput,
  type MunicipalityExpectedVotesInput,
  type MunicipalityPoliticalTrendInput,
  type MunicipalityStrategyUpdateInput,
} from '@/lib/schemas/municipality'
import { normalizeVoteEstimateOnSave, toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignUser } from '@/payload-types'
import {
  getCampaignActionContext,
  reloadStaffActor,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

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

/**
 * E14 — moving a município up or down the N0–N4 ladder. Two writes in one
 * transaction: the município carries the current level, and `allocationDecision`
 * carries the movement forever (C12's first production writer), so the history
 * survives the next movement instead of being overwritten by it.
 *
 * The lock is what makes the recorded "nível anterior" true: without it two
 * coordinators moving the same município would each read the same `from` and
 * write two decisions claiming to start from it.
 */
export const setMunicipalityEngagementLevelRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityEngagementLevelInput,
) => {
  const { municipality, level, note, triangulatedShock, override } =
    municipalityEngagementLevelSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadUnrestrictedActor(
        payload,
        actor,
        MUNICIPALITY_ENGAGEMENT_LEVEL_UNRESTRICTED_MESSAGE,
        req,
      )

      await acquireTextAdvisoryLocks(payload, req, [
        `municipality-engagement-level:${municipality}`,
      ])

      const current = await payload.findByID({
        collection: 'municipality',
        id: municipality,
        depth: 0,
        select: { engagementLevel: true, levelChangedAt: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const from = current.engagementLevel ?? null
      const violations = getEngagementLevelViolations({
        from,
        to: level,
        levelChangedAt: current.levelChangedAt ?? null,
        now: new Date(),
        triangulatedShock,
      })

      if (violations.length > 0 && !override) throw new EngagementLevelBlockedError(violations)

      const updated = await payload.update({
        collection: 'municipality',
        id: municipality,
        data: { engagementLevel: level, levelNote: note },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      await payload.create({
        collection: 'allocationDecision',
        data: {
          municipality,
          patternId: ENGAGEMENT_LEVEL_PATTERN_ID,
          outcome: 'movimento',
          rationale: note ?? '',
          // Only the values the decision was taken on — no document dumps
          // (the collection caps the serialized snapshot at 16 KB).
          snapshot: {
            from,
            to: level,
            triangulatedShock,
            violations: violations.map((violation) => violation.id),
            overridden: violations.length > 0,
            previousLevelChangedAt: current.levelChangedAt ?? null,
          },
        },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })

      return updated
    },
    { beginFailureMessage: 'Não foi possível iniciar o movimento de nível.' },
  )
}

export const setMunicipalityEngagementLevel = async (input: MunicipalityEngagementLevelInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return setMunicipalityEngagementLevelRecord(payload, actor, input)
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
        MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
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

/**
 * Single-advisor delta from the list popover — writes one toggle instead of
 * replacing the whole `advisors` array, so a concurrent edit from another
 * tab/actor is never clobbered. Same lock and eligibility hook as
 * `assignMunicipalityAdvisorsRecord`; unlike it, the target can be coordinator
 * or candidate too (the popover lists every unrestricted staff member as
 * eligible, not just `advisor`-role accounts), so it does not reuse
 * `assertTargetAdvisor` from `actions/advisor.ts`. Deliberately does not
 * revalidate — the list's facet/sort by advisor reconciles on next navigation,
 * same choice as the votos estimados popover.
 */
export const setMunicipalityAdvisorMembershipRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityAdvisorMembershipInput,
) => {
  const { municipality, advisor, assigned } = municipalityAdvisorMembershipSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      await reloadUnrestrictedActor(
        payload,
        actor,
        MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
        req,
      )

      await acquireTextAdvisoryLocks(payload, req, [`municipality-advisors:${municipality}`])

      const current = await payload.findByID({
        collection: 'municipality',
        id: municipality,
        depth: 0,
        select: { advisors: true },
        overrideAccess: true,
        req,
      })

      const currentAdvisorIDs = uniqueRelationshipIds(current.advisors)
      const nextAdvisorIDs = nextAdvisorIdsAfterMembership(currentAdvisorIDs, advisor, assigned)
      if (nextAdvisorIDs === null) return current

      // Intentional admin bypass: unrestricted role was freshly verified above;
      // the advisors field is admin-only by field access, and eligibility is
      // reconfirmed by the `validateMunicipalityAdvisors` beforeValidate hook.
      return payload.update({
        collection: 'municipality',
        id: municipality,
        data: { advisors: nextAdvisorIDs },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a atualização de assessores.' },
  )
}

export const setMunicipalityAdvisorMembership = async (
  input: MunicipalityAdvisorMembershipInput,
) => {
  const { payload, actor } = await getCampaignActionContext()
  return setMunicipalityAdvisorMembershipRecord(payload, actor, input)
}
