import type { Payload } from 'payload'

import { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import type { CampaignUser } from '@/payload-types'
import {
  municipalityElectionGeography,
  type MunicipalityElectionGeography,
} from '@/utilities/municipalityElectionGeography'
import {
  loadCandidateVotesByCityZone,
  loadValidVotesByCityZone,
  sumVotesForGeography,
} from '@/utilities/municipalityElectoralBaseline'
import { buildMunicipalitiesByIbgeCode, type MunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'
import {
  buildMunicipalityListWhere,
  parseMunicipalityListParams,
  type MunicipalityListSearchParams,
  type MunicipalityListState,
} from '@/utilities/municipalityUi'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
} from '@/utilities/voteEstimate'
import {
  aggregatePledgesByMunicipality,
  emptyMunicipalityPledgeAggregate,
  resolveMunicipalityStaffVoteTotal,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeData'

export type { MunicipalityMapSlugEntry, MunicipalitiesByIbgeCode } from '@/utilities/municipalityMapNavigation'

export const PLAZA_MAP_YEARS = [...HISTORICAL_SERIES_YEARS, 2026] as const
export type MunicipalityMapYear = (typeof PLAZA_MAP_YEARS)[number]

export type MunicipalityMapScaleMode = 'absolute' | 'percentValid'

export const PLAZA_MAP_SCALE_MODES = [
  'percentValid',
  'absolute',
] as const satisfies readonly MunicipalityMapScaleMode[]

export const municipalityMapScaleModeLabels: Record<MunicipalityMapScaleMode, string> = {
  absolute: 'Total (votos)',
  percentValid: '% dos válidos',
}

export const municipalityMapYearLabels: Record<MunicipalityMapYear, string> = {
  2014: '2014 (TSE)',
  2018: '2018 (TSE)',
  2022: '2022 (TSE)',
  2026: '2026 (estimativas)',
}

export type MunicipalityZoneBreakdownRow = {
  slug: string
  name: string
  votesByYear: Record<string, number>
  votes2026ByScenario: Record<VoteEstimateScenario, number>
}

export type MunicipalityMapComparison = {
  candidateNumber: number
  candidateName: string
  /** TSE year (as string) → codarea → (sollaVotes − otherVotes). */
  diffByYear: Record<string, Record<string, number>>
}

export type MunicipalityMapBundle = {
  /** year (as string) → codarea → value. 2026 = cenário médio (central). */
  valuesByYear: Record<string, Record<string, number>>
  /** 2026 totals per estimate scenario (codarea → votes). */
  values2026ByScenario: Record<VoteEstimateScenario, Record<string, number>>
  /** year (as string) → codarea → votosValidos (federal T1). 2026 reuses 2022. */
  validVotesByYear: Record<string, Record<string, number>>
  /** IBGE codarea → accessible municipality slugs for map click navigation. */
  municipalitiesByIbgeCode: MunicipalitiesByIbgeCode
  /** Zone municipalities in scope (Salvador/Camaçari) with per-year values. */
  zoneBreakdown: MunicipalityZoneBreakdownRow[]
  candidateName: string
  comparison: MunicipalityMapComparison | null
}

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

const loadScopedMunicipalities = async (
  payload: Payload,
  user: CampaignUser,
  state: MunicipalityListState,
): Promise<ScopedMunicipality[]> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { slug: true, name: true, kind: true, ibgeCode: true, expectedVotes: true },
    where: buildMunicipalityListWhere(state),
    user,
    overrideAccess: false,
  })

  return scopeMunicipalitiesFromDocs(result.docs)
}

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
  const sollaVotesByYear = new Map<number, Map<string, number>>()

  const yearLoads = await Promise.all(
    HISTORICAL_SERIES_YEARS.map(async (year) => {
      const [votesByCityZone, validByCityZone] = await Promise.all([
        loadCandidateVotesByCityZone(payload, user, {
          year,
          candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
        }),
        loadValidVotesByCityZone(payload, user, { year }),
      ])
      return { year, votesByCityZone, validByCityZone }
    }),
  )

  for (const { year, votesByCityZone, validByCityZone } of yearLoads) {
    sollaVotesByYear.set(year, votesByCityZone)
    const values: Record<string, number> = {}
    const validValues: Record<string, number> = {}
    for (const municipality of municipalities) {
      const votes = sumVotesForGeography(votesByCityZone, municipality.geography)
      values[municipality.ibgeCode] = (values[municipality.ibgeCode] ?? 0) + votes
      const valid = sumVotesForGeography(validByCityZone, municipality.geography)
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
          const sollaVotes = sollaVotesByYear.get(year) ?? new Map<string, number>()
          const values: Record<string, number> = {}
          for (const municipality of municipalities) {
            const solla = sumVotesForGeography(sollaVotes, municipality.geography)
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
  const municipalities = await loadScopedMunicipalities(payload, user, state)
  if (municipalities.length === 0) return null

  const pledgeAggregates = await aggregatePledgesByMunicipality(
    payload,
    municipalities.map((municipality) => municipality.id),
  )

  return buildMunicipalityMapBundleFromMunicipalities(payload, user, state, municipalities, pledgeAggregates)
}
