import 'server-only'

import type { Payload } from 'payload'
import { cache } from 'react'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { slugsForMetropolitanoSubRowLabel } from '@/lib/metropolitanoTerritoryPeers'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, type VoteEstimateScenario } from '@/lib/voteEstimate'
import type { CampaignUser, Municipality, User } from '@/payload-types'
import { loadMunicipalityScopeFromDocs } from '@/utilities/municipality/campaignMunicipalityScope'
import { loadMunicipalityGoalCoverageBundle } from '@/utilities/municipality/municipalityGoalAccount'
import { fieldCeiling, ownVotes2022 } from '@/utilities/municipality/municipalityPotential'
import { computeAggregateTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import {
  computeTerritoryRollup,
  type TerritoryMunicipalityInput,
  type TerritoryOverviewRow,
} from '@/utilities/territory/territoryOverview'
import {
  emptyMunicipalityPledgeAggregate,
  resolveMunicipalityStaffVoteTotal,
} from '@/utilities/votePledgeViews'

type MunicipalityDoc = Pick<
  Municipality,
  'id' | 'slug' | 'name' | 'city' | 'region' | 'kind' | 'advisors' | 'expectedVotes'
>

type TerritoryReader = CampaignUser | User

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
 * E17 + E12 — Loads the full 27-TI overview (all 435 municipalities).
 *
 * Regional context is intentionally non-scoped: an advisor sees the complete
 * comparative table (leitura regional é contexto, não gestão). Exposure is
 * TI-level aggregates only — never per-municipality PII. Leaders never reach
 * this (the Início page routes them to the contact tool first).
 */
export const loadTerritoryOverview = cache(
  async (
    payload: Payload,
    user: TerritoryReader,
    scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
  ): Promise<TerritoryOverviewRow[]> => {
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
      const estimate = resolveMunicipalityStaffVoteTotal(
        doc.expectedVotes ?? null,
        aggregate.effectiveByScenario[scenario],
        scenario,
      )
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
        estimate2026: estimate,
        advisorCount: doc.advisors?.length ?? 0,
        ownVotes2022: ownVotes2022(baseline),
        fieldCeiling2022: fieldCeiling(baseline),
        goalCoverage,
      }
    })

    const rows = computeTerritoryRollup(inputs)
    return attachTerritorialClasses(inputs, rows)
  },
)
