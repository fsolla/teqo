import 'server-only'

import type { Payload } from 'payload'
import { cache } from 'react'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, type VoteEstimateScenario } from '@/lib/voteEstimate'
import type { Municipality } from '@/payload-types'
import {
  computeTerritoryRollup,
  type TerritoryMunicipalityInput,
  type TerritoryOverviewRow,
} from '@/utilities/territoryOverview'
import { aggregatePledgesByMunicipality } from '@/utilities/votePledgeData'
import {
  emptyMunicipalityPledgeAggregate,
  resolveMunicipalityStaffVoteTotal,
} from '@/utilities/votePledgeViews'

type MunicipalityDoc = Pick<
  Municipality,
  'id' | 'slug' | 'name' | 'city' | 'region' | 'kind' | 'advisors' | 'expectedVotes'
>

/**
 * E17 — Loads the full 27-TI overview (all 435 municipalities, `overrideAccess: true`).
 *
 * Regional context is intentionally non-scoped: an advisor sees the complete
 * comparative table (leitura regional é contexto, não gestão). Exposure is
 * TI-level aggregates only — never per-municipality PII. Leaders never reach
 * this (the Início page routes them to the contact tool first).
 */
export const loadTerritoryOverview = cache(
  async (
    payload: Payload,
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
    const aggregates = await aggregatePledgesByMunicipality(
      payload,
      docs.map((doc) => doc.id),
    )

    const inputs: TerritoryMunicipalityInput[] = docs.map((doc) => {
      const baseline = getMunicipalityFederalBaseline(doc.slug)
      const aggregate = aggregates.get(doc.id) ?? emptyMunicipalityPledgeAggregate
      const estimate = resolveMunicipalityStaffVoteTotal(
        doc.expectedVotes ?? null,
        aggregate.effectiveByScenario[scenario],
        scenario,
      )
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
      }
    })

    return computeTerritoryRollup(inputs)
  },
)
