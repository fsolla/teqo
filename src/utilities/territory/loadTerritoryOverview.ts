import 'server-only'

import type { Payload } from 'payload'
import { cache } from 'react'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { slugsForMetropolitanoSubRowLabel } from '@/lib/metropolitanoTerritoryPeers'
import { relationshipId } from '@/lib/relationship'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  hasAnyVoteEstimate,
  resolveMunicipalityStaffVoteTotalForScenario,
  toVoteEstimateScenarioViewModel,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import type { CampaignUser, Municipality } from '@/payload-types'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import { loadMunicipalityScopeFromDocs } from '@/utilities/municipality/campaignMunicipalityScope'
import { loadMunicipalityGoalCoverageBundle } from '@/utilities/municipality/municipalityGoalAccount'
import { fieldCeiling, ownVotes2022 } from '@/utilities/municipality/municipalityPotential'
import { computeAggregateTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import {
  loadAdvisorSummaries,
  loadMunicipalityLeadershipSummaries,
  type MunicipalityAdvisorSummary,
  type MunicipalityLeadershipSummary,
} from '@/utilities/municipality/municipalityViewModels'
import {
  computeTerritoryRollup,
  type TerritoryMunicipalityInput,
  type TerritoryOverviewRow,
} from '@/utilities/territory/territoryOverview'
import { emptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

type MunicipalityDoc = Pick<
  Municipality,
  | 'id'
  | 'slug'
  | 'name'
  | 'city'
  | 'region'
  | 'kind'
  | 'advisors'
  | 'stateDeputies'
  | 'expectedVotes'
>

/** Aggregate name lookups the territory network columns render (B175). */
export type TerritoryStateDeputyReference = {
  id: number
  plainName: string
  party: string | null
  href: string
}

export type TerritoryNetworkReferences = {
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  stateDeputyById: ReadonlyMap<number, TerritoryStateDeputyReference>
}

const attachTerritorialClasses = (
  inputs: ReadonlyArray<TerritoryMunicipalityInput>,
  rows: TerritoryOverviewRow[],
): TerritoryOverviewRow[] =>
  rows.map((row) => {
    const regionSlugs = inputs
      .filter((input) => input.region === row.region)
      .map((input) => input.slug)
    const subRows = row.subRows?.map((subRow) => ({
      ...subRow,
      territorialClass: computeAggregateTerritorialClass(
        slugsForMetropolitanoSubRowLabel(inputs, subRow.label),
      ),
    }))
    return {
      ...row,
      territorialClass: computeAggregateTerritorialClass(regionSlugs),
      subRows,
    }
  })

/**
 * E17 + E12 + B175 — Loads the full 27-TI overview (all 435 municipalities)
 * plus the aggregate name lookups for the read-only network columns
 * (Assessor / Liderança / Dobradinha).
 *
 * Regional context is intentionally non-scoped: an advisor sees the complete
 * comparative table (leitura regional é contexto, não gestão). Exposure is
 * TI-level aggregates only — never per-municipality PII. Network names honour
 * the existing read-access contracts (`canReadCampaignUsers` for advisors,
 * `canReadLeadership` for leaderships, `canReadStateDeputy` for dobradinhas),
 * so an advisor never learns leaderships outside the municipalities they
 * administer. Leaders never reach this (`gate: noLeader` on the page).
 */
export const loadTerritoryOverview = cache(
  async (
    payload: Payload,
    user: CampaignUser,
    scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
  ): Promise<{
    rows: TerritoryOverviewRow[]
    references: TerritoryNetworkReferences
  }> => {
    const result = await payload.find({
      collection: 'municipality',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        region: true,
        kind: true,
        advisors: true,
        stateDeputies: true,
        expectedVotes: true,
      },
    })

    const docs = result.docs as MunicipalityDoc[]
    const { pledgeAggregates: aggregates } = await loadMunicipalityScopeFromDocs(payload, docs)

    const { coverageByMunicipalityID } = await loadMunicipalityGoalCoverageBundle(
      payload,
      user,
      docs,
      aggregates,
    )

    const inputs: TerritoryMunicipalityInput[] = docs.map((doc) => {
      const baseline = getMunicipalityFederalBaseline(doc.slug)
      const aggregate = aggregates.get(doc.id) ?? emptyMunicipalityPledgeAggregate
      const expectedView = toVoteEstimateScenarioViewModel(doc.expectedVotes)
      const estimateByScenario = {} as Record<VoteEstimateScenario, number>
      for (const key of VOTE_ESTIMATE_SCENARIOS) {
        estimateByScenario[key] = resolveMunicipalityStaffVoteTotalForScenario(
          doc.expectedVotes,
          aggregate.effectiveByScenario[key],
          key,
        )
      }
      const coverageByScenario = coverageByMunicipalityID.get(doc.id)
      const goalCoverage = coverageByScenario?.[scenario] ?? {
        goal: 0,
        committed: 0,
        coverageRatio: null,
        deficit: 0,
      }

      return {
        slug: doc.slug,
        name: doc.name,
        city: doc.city,
        region: doc.region,
        kind: doc.kind,
        votesByYear: { ...baseline.votesByYear },
        validVotesByYear: { ...baseline.validVotesByYear },
        estimateByScenario,
        hasEstimate: hasAnyVoteEstimate(expectedView) || aggregate.declaredTotal > 0,
        advisorIDs: (doc.advisors ?? [])
          .map(relationshipId)
          .filter((id): id is number => id !== null),
        stateDeputyIDs: (doc.stateDeputies ?? [])
          .map(relationshipId)
          .filter((id): id is number => id !== null),
        leadershipIDs: [],
        ownVotes2022: ownVotes2022(baseline),
        fieldCeiling2022: fieldCeiling(baseline),
        goalCoverage,
      }
    })

    const municipalityIDs = docs.map((doc) => doc.id)
    const { leadershipIDsByMunicipality, summariesById: leadershipNamesById } =
      await loadMunicipalityLeadershipSummaries(payload, user, municipalityIDs)

    for (let index = 0; index < docs.length; index += 1) {
      const leadershipIDs = leadershipIDsByMunicipality.get(docs[index]!.id)
      if (leadershipIDs) inputs[index]!.leadershipIDs = leadershipIDs
    }

    const rows = attachTerritorialClasses(inputs, computeTerritoryRollup(inputs))

    const usedStateDeputyIDs = new Set(inputs.flatMap((input) => input.stateDeputyIDs))
    const stateDeputyById = new Map<number, TerritoryStateDeputyReference>()
    if (usedStateDeputyIDs.size > 0) {
      for (const option of await loadStateDeputyOptions(payload, user)) {
        if (!usedStateDeputyIDs.has(option.id)) continue
        stateDeputyById.set(option.id, {
          id: option.id,
          plainName: option.plainName,
          party: option.party ?? null,
          href: `/campanha/dobradinhas/${option.id}`,
        })
      }
    }

    const usedAdvisorIDs = [...new Set(inputs.flatMap((input) => input.advisorIDs))]
    const advisorSummaries = await loadAdvisorSummaries(payload, user, usedAdvisorIDs)
    const advisorNamesById = new Map(advisorSummaries.map((advisor) => [advisor.id, advisor]))

    return {
      rows,
      references: {
        advisorNamesById,
        leadershipNamesById,
        stateDeputyById,
      },
    }
  },
)
