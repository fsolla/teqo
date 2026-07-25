import 'server-only'

import type { Payload } from 'payload'

import { getMunicipalityFederalBaseline } from '@/lib/bahiaElectionAggregates'
import { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/campaignMunicipalityScope'
import {
  municipalityElectionGeography,
  type MunicipalityElectionGeography,
} from '@/utilities/municipalityElectionGeography'
import {
  loadCandidateVotesByCityZone,
  sumVotesForGeography,
} from '@/utilities/municipalityElectoralBaseline'
import type {
  MunicipalityMapBundle,
  MunicipalityMapComparison,
} from '@/utilities/municipalityMapContract'
import { buildMunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'
import {
  buildMunicipalityListWhere,
  parseMunicipalityListParams,
  type MunicipalityListSearchParams,
  type MunicipalityListState,
} from '@/utilities/municipalityListUrl'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import { emptyMunicipalityPledgeAggregate, resolveMunicipalityStaffVoteTotal, type MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

export type { MunicipalityMapSlugEntry, MunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'
// Client components import the map vocabulary from the contract module; the
// server side re-exports it so data callers have one import surface.
export type {
  MunicipalityMapBundle,
  MunicipalityMapComparison,
  MunicipalityMapScaleMode,
  MunicipalityMapYear,
  MunicipalityZoneBreakdownRow,
} from '@/utilities/municipalityMapContract'

export type ScopedMunicipality = {
  id: number
  slug: string
  name: string
  kind: 'municipio' | 'zona'
  ibgeCode: string
  expectedVotes?: {
    pessimistic?: number | null
    central?: number | null
    optimistic?: number | null
  } | null
  geography: MunicipalityElectionGeography
}

type ScopedMunicipalityDoc = {
  id: number
  slug: string
  name: string
  kind: 'municipio' | 'zona'
  ibgeCode: string
  expectedVotes?: {
    pessimistic?: number | null
    central?: number | null
    optimistic?: number | null
  } | null
}

export const scopeMunicipalitiesFromDocs = (docs: ReadonlyArray<ScopedMunicipalityDoc>): ScopedMunicipality[] =>
  docs.flatMap((municipality) => {
    const entry = getMunicipalityCatalogEntry(municipality.slug)
    if (!entry) return []
    return [
      {
        id: municipality.id,
        slug: municipality.slug,
        name: municipality.name,
        kind: municipality.kind,
        ibgeCode: municipality.ibgeCode,
        expectedVotes: municipality.expectedVotes ?? null,
        geography: municipalityElectionGeography(entry),
      },
    ]
  })

export const buildMunicipalityMapBundleFromMunicipalities = async (
  payload: Payload,
  user: CampaignUser,
  state: MunicipalityListState,
  municipalities: ScopedMunicipality[],
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>,
): Promise<MunicipalityMapBundle | null> => {
  if (municipalities.length === 0) return null

  const valuesByYear: Record<string, Record<string, number>> = {}
  const validVotesByYear: Record<string, Record<string, number>> = {}
  const zoneVotesBySlug = new Map<string, Record<string, number>>()

  // Historical years come from the committed artifact (immutable TSE data,
  // pre-aggregated per municipality) — zero database work.
  for (const year of HISTORICAL_SERIES_YEARS) {
    const values: Record<string, number> = {}
    const validValues: Record<string, number> = {}
    for (const municipality of municipalities) {
      const baseline = getMunicipalityFederalBaseline(municipality.slug)
      const votes = baseline.votesByYear[String(year)] ?? 0
      values[municipality.ibgeCode] = (values[municipality.ibgeCode] ?? 0) + votes
      const valid = baseline.validVotesByYear[String(year)] ?? 0
      validValues[municipality.ibgeCode] = (validValues[municipality.ibgeCode] ?? 0) + valid
      if (municipality.kind === 'zona') {
        const bySlug = zoneVotesBySlug.get(municipality.slug) ?? {}
        bySlug[String(year)] = votes
        zoneVotesBySlug.set(municipality.slug, bySlug)
      }
    }
    valuesByYear[String(year)] = values
    validVotesByYear[String(year)] = validValues
  }
  validVotesByYear['2026'] = validVotesByYear['2022'] ?? {}

  const pledgeValuesByScenario = Object.fromEntries(
    VOTE_ESTIMATE_SCENARIOS.map((scenario) => [scenario, {} as Record<string, number>]),
  ) as Record<VoteEstimateScenario, Record<string, number>>
  const zoneVotes2026BySlug = new Map<string, Record<VoteEstimateScenario, number>>()
  const emptyZoneScenarioVotes = (): Record<VoteEstimateScenario, number> => ({
    pessimistic: 0,
    central: 0,
    optimistic: 0,
  })

  for (const municipality of municipalities) {
    const aggregate = pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      const votes = resolveMunicipalityStaffVoteTotal(
        municipality.expectedVotes,
        aggregate.effectiveByScenario[scenario],
        scenario,
      )
      if (votes > 0) {
        pledgeValuesByScenario[scenario][municipality.ibgeCode] =
          (pledgeValuesByScenario[scenario][municipality.ibgeCode] ?? 0) + votes
      }
      if (municipality.kind === 'zona') {
        const byScenario = zoneVotes2026BySlug.get(municipality.slug) ?? emptyZoneScenarioVotes()
        byScenario[scenario] = votes
        zoneVotes2026BySlug.set(municipality.slug, byScenario)
        if (scenario === DEFAULT_VOTE_ESTIMATE_SCENARIO) {
          const bySlug = zoneVotesBySlug.get(municipality.slug) ?? {}
          bySlug['2026'] = votes
          zoneVotesBySlug.set(municipality.slug, bySlug)
        }
      }
    }
  }
  valuesByYear['2026'] = pledgeValuesByScenario[DEFAULT_VOTE_ESTIMATE_SCENARIO]

  const zoneBreakdown = municipalities
    .filter((municipality) => municipality.kind === 'zona')
    .map((municipality) => ({
      slug: municipality.slug,
      name: municipality.name,
      votesByYear: zoneVotesBySlug.get(municipality.slug) ?? {},
      votes2026ByScenario: zoneVotes2026BySlug.get(municipality.slug) ?? emptyZoneScenarioVotes(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  let comparison: MunicipalityMapComparison | null = null
  const compareCandidate = state.compare
  if (compareCandidate) {
    const candidates = await payload.find({
      collection: 'electionCandidate',
      where: {
        and: [
          { candidateNumber: { equals: compareCandidate } },
          { office: { equals: 'deputado_federal' } },
          { turn: { equals: '1' } },
        ],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      sort: '-year',
      select: { urnaName: true, party: true },
      overrideAccess: true,
    })
    const candidate = candidates.docs[0]

    if (candidate) {
      const diffByYear: Record<string, Record<string, number>> = {}
      await Promise.all(
        HISTORICAL_SERIES_YEARS.map(async (year) => {
          const otherVotes = await loadCandidateVotesByCityZone(payload, user, {
            year,
            candidateNumber: compareCandidate,
          })
          const values: Record<string, number> = {}
          for (const municipality of municipalities) {
            const solla =
              getMunicipalityFederalBaseline(municipality.slug).votesByYear[String(year)] ?? 0
            const other = sumVotesForGeography(otherVotes, municipality.geography)
            values[municipality.ibgeCode] = (values[municipality.ibgeCode] ?? 0) + (solla - other)
          }
          diffByYear[String(year)] = values
        }),
      )

      comparison = {
        candidateNumber: compareCandidate,
        candidateName: `${candidate.urnaName}${candidate.party ? ` (${candidate.party})` : ''}`,
        diffByYear,
      }
    }
  }

  return {
    valuesByYear,
    values2026ByScenario: pledgeValuesByScenario,
    validVotesByYear,
    municipalitiesByIbgeCode: buildMunicipalitiesByIbgeCode(municipalities),
    zoneBreakdown,
    candidateName: BASELINE_TICKET_2022.candidate.name,
    comparison,
  }
}

/**
 * Map data for the Praças overview: municipalities matching the list URL filters (and
 * role access) contribute their geography's votes (or 2026 pledge estimates)
 * to municipality polygons. When `state.compare` is set, TSE years also carry
 * a red↔white↔blue diff (Solla − other candidate).
 */
export const loadMunicipalityMapBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: MunicipalityListSearchParams,
): Promise<MunicipalityMapBundle | null> => {
  if (user.role === 'leader') return null

  const state = parseMunicipalityListParams(searchParams)
  const scope = await loadMunicipalityScope(payload, user, buildMunicipalityListWhere(state))
  const municipalities = scopeMunicipalitiesFromDocs(scope.municipalities)
  if (municipalities.length === 0) return null

  return buildMunicipalityMapBundleFromMunicipalities(
    payload,
    user,
    state,
    municipalities,
    scope.pledgeAggregates,
  )
}
