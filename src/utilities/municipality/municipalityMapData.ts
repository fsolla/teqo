import 'server-only'

import type { Payload } from 'payload'

import {
  getFederalCompetitiveRank,
  getMunicipalityFederalBaseline,
  getStatewideFederalTotals,
} from '@/lib/bahiaElectionAggregates'
import { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
  type VoteEstimateScenarioFields,
} from '@/lib/voteEstimate'
import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import {
  municipalityElectionGeography,
  type MunicipalityElectionGeography,
} from '@/utilities/municipality/municipalityElectionGeography'
import {
  loadCandidateVotesByCityZone,
  sumVotesForGeography,
} from '@/utilities/municipality/municipalityElectoralBaseline'
import {
  buildMunicipalityListWhere,
  parseMunicipalityListParams,
  type MunicipalityListSearchParams,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import type {
  FederalCompetitiveRankTuple,
  MunicipalityMapBundle,
  MunicipalityMapComparison,
} from '@/utilities/municipality/municipalityMapContract'
import {
  buildMunicipalitiesByMapKey,
  mapKeyForMunicipality,
} from '@/utilities/municipality/municipalityMapNavigation'
import { projectedValidVotes } from '@/utilities/municipality/municipalityPotential'
import { loadMunicipalityListRelationCatalog } from '@/utilities/municipality/municipalityRelationSets'
import {
  computeMunicipalityTerritorialClass,
  type MunicipalityTerritorialClass,
} from '@/utilities/municipality/municipalityTerritorialClass'
import {
  emptyMunicipalityPledgeAggregate,
  resolveMunicipalityStaffVoteTotal,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeViews'

// Client components import the map vocabulary from the contract module; the
// server side re-exports it so data callers have one import surface.
export type { MunicipalityMapBundle } from '@/utilities/municipality/municipalityMapContract'

type ScopedMunicipality = {
  id: number
  slug: string
  name: string
  kind: 'municipio' | 'zona'
  ibgeCode: string
  expectedVotes?: VoteEstimateScenarioFields | null
  geography: MunicipalityElectionGeography
}

type ScopedMunicipalityDoc = {
  id: number
  slug: string
  name: string
  kind: 'municipio' | 'zona'
  ibgeCode: string
  expectedVotes?: VoteEstimateScenarioFields | null
}

const scopeMunicipalitiesFromDocs = (
  docs: ReadonlyArray<ScopedMunicipalityDoc>,
): ScopedMunicipality[] =>
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

const buildMunicipalityMapBundleFromMunicipalities = async (
  payload: Payload,
  user: CampaignUser,
  state: MunicipalityListState,
  municipalities: ScopedMunicipality[],
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>,
): Promise<MunicipalityMapBundle | null> => {
  if (municipalities.length === 0) return null

  const valuesByYear: Record<string, Record<string, number>> = {}
  const validVotesByYear: Record<string, Record<string, number>> = {}
  const statewideShareByYear: Record<string, number> = {}
  const competitiveRankByYear: Record<string, Record<string, FederalCompetitiveRankTuple>> = {}
  // One polygon per catalog unit since B8 F2, so this index — the same one the
  // map navigates by — is also the key of every rollup below.
  const municipalitiesByMapKey = buildMunicipalitiesByMapKey(municipalities)

  // Historical years come from the committed artifact (immutable TSE data,
  // pre-aggregated per municipality) — zero database work.
  for (const year of HISTORICAL_SERIES_YEARS) {
    const values: Record<string, number> = {}
    const validValues: Record<string, number> = {}
    for (const municipality of municipalities) {
      const mapKey = mapKeyForMunicipality(municipality)
      const baseline = getMunicipalityFederalBaseline(municipality.slug)
      const votes = baseline.votesByYear[String(year)] ?? 0
      values[mapKey] = votes
      validValues[mapKey] = baseline.validVotesByYear[String(year)] ?? 0
    }
    valuesByYear[String(year)] = values
    validVotesByYear[String(year)] = validValues

    // The LQ denominator is his STATEWIDE standard, not the average of what is
    // on screen: an advisor looking at 14 municípios must read the same "2×"
    // that the list's "Classe" column shows.
    const statewide = getStatewideFederalTotals(year)
    statewideShareByYear[String(year)] =
      statewide.validVotes > 0 ? statewide.ownVotes / statewide.validVotes : 0

    // Rank exists per city only, so every zone of Salvador carries the city's
    // position — stated in the legend rather than faked per zone.
    const ranks: Record<string, FederalCompetitiveRankTuple> = {}
    for (const municipality of municipalities) {
      const rank = getFederalCompetitiveRank(municipality.ibgeCode, year)
      if (rank) ranks[mapKeyForMunicipality(municipality)] = [rank.rank, rank.candidates]
    }
    competitiveRankByYear[String(year)] = ranks
  }
  validVotesByYear['2026'] = validVotesByYear['2022'] ?? {}
  // 2026 has no statewide truth to measure against — the estimates only exist
  // where the mesa filled them in — so it keeps 2022 as the standard, the same
  // substitution `validVotesByYear` already makes.
  statewideShareByYear['2026'] = statewideShareByYear['2022'] ?? 0

  const territorialClassByMapKey: Record<string, MunicipalityTerritorialClass> = {}
  const projectedValidVotesByMapKey: Record<string, number> = {}
  for (const [mapKey, slug] of Object.entries(municipalitiesByMapKey)) {
    territorialClassByMapKey[mapKey] = computeMunicipalityTerritorialClass(slug).class
    projectedValidVotesByMapKey[mapKey] = projectedValidVotes(getMunicipalityFederalBaseline(slug))
  }

  const pledgeValuesByScenario = Object.fromEntries(
    VOTE_ESTIMATE_SCENARIOS.map((scenario) => [scenario, {} as Record<string, number>]),
  ) as Record<VoteEstimateScenario, Record<string, number>>

  for (const municipality of municipalities) {
    const aggregate = pledgeAggregates.get(municipality.id) ?? emptyMunicipalityPledgeAggregate
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      const votes = resolveMunicipalityStaffVoteTotal(
        municipality.expectedVotes,
        aggregate.effectiveByScenario[scenario],
        scenario,
      )
      if (votes > 0) {
        pledgeValuesByScenario[scenario][mapKeyForMunicipality(municipality)] = votes
      }
    }
  }
  valuesByYear['2026'] = pledgeValuesByScenario[DEFAULT_VOTE_ESTIMATE_SCENARIO]

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
      // Intentional admin bypass: the compare candidate is chosen by ballot
      // number — a public TSE registry fact — and `electionCandidate` read
      // access requires a session while this loader already ran its own staff
      // gate upstream. Ballot name + party disclose nothing person-scoped.
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
            values[mapKeyForMunicipality(municipality)] = solla - other
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
    statewideShareByYear,
    territorialClassByMapKey,
    competitiveRankByYear,
    projectedValidVotesByMapKey,
    municipalitiesByMapKey,
    hasZoneMunicipalities: municipalities.some((municipality) => municipality.kind === 'zona'),
    candidateName: BASELINE_TICKET_2022.candidate.name,
    comparison,
  }
}

/**
 * Map data for the municipalities overview: municipalities matching the list URL filters (and
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
  // B176 — the map shares the list URL, so a leadership/party recorte must
  // carry its relation catalog into the very same `where` the list uses. Lazy
  // per active filter, so the dashboard landing page pays no extra reads.
  const relationCatalog = await loadMunicipalityListRelationCatalog(payload, user, state)
  const scope = await loadMunicipalityScope(
    payload,
    user,
    buildMunicipalityListWhere(state, relationCatalog),
  )
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
