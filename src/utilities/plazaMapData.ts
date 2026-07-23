import type { Payload } from 'payload'

import { BASELINE_TICKET_2022, HISTORICAL_SERIES_YEARS } from '@/lib/electionResults'
import { getPlazaCatalogEntry } from '@/lib/plazaCatalog'
import type { CampaignUser } from '@/payload-types'
import {
  plazaElectionGeography,
  type PlazaElectionGeography,
} from '@/utilities/plazaElectionGeography'
import {
  loadCandidateVotesByCityZone,
  loadValidVotesByCityZone,
  sumVotesForGeography,
} from '@/utilities/plazaElectoralBaseline'
import { buildPlazasByIbgeCode, type PlazasByIbgeCode } from '@/utilities/plazaMapNavigation'
import {
  buildPlazaListWhere,
  parsePlazaListParams,
  type PlazaListSearchParams,
  type PlazaListState,
} from '@/utilities/plazaUi'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  VOTE_ESTIMATE_SCENARIOS,
  type VoteEstimateScenario,
} from '@/utilities/voteEstimate'
import {
  aggregatePledgesByPlaza,
  emptyPlazaPledgeAggregate,
  resolvePlazaStaffVoteTotal,
  type PlazaPledgeAggregate,
} from '@/utilities/votePledgeData'

export type { PlazaMapSlugEntry, PlazasByIbgeCode } from '@/utilities/plazaMapNavigation'

export const PLAZA_MAP_YEARS = [...HISTORICAL_SERIES_YEARS, 2026] as const
export type PlazaMapYear = (typeof PLAZA_MAP_YEARS)[number]

export type PlazaMapScaleMode = 'absolute' | 'percentValid'

export const PLAZA_MAP_SCALE_MODES = [
  'percentValid',
  'absolute',
] as const satisfies readonly PlazaMapScaleMode[]

export const plazaMapScaleModeLabels: Record<PlazaMapScaleMode, string> = {
  absolute: 'Total (votos)',
  percentValid: '% dos válidos',
}

export const plazaMapYearLabels: Record<PlazaMapYear, string> = {
  2014: '2014 (TSE)',
  2018: '2018 (TSE)',
  2022: '2022 (TSE)',
  2026: '2026 (estimativas)',
}

export type PlazaZoneBreakdownRow = {
  slug: string
  name: string
  votesByYear: Record<string, number>
  votes2026ByScenario: Record<VoteEstimateScenario, number>
}

export type PlazaMapComparison = {
  candidateNumber: number
  candidateName: string
  /** TSE year (as string) → codarea → (sollaVotes − otherVotes). */
  diffByYear: Record<string, Record<string, number>>
}

export type PlazaMapBundle = {
  /** year (as string) → codarea → value. 2026 = cenário médio (central). */
  valuesByYear: Record<string, Record<string, number>>
  /** 2026 totals per estimate scenario (codarea → votes). */
  values2026ByScenario: Record<VoteEstimateScenario, Record<string, number>>
  /** year (as string) → codarea → votosValidos (federal T1). 2026 reuses 2022. */
  validVotesByYear: Record<string, Record<string, number>>
  /** IBGE codarea → accessible plaza slugs for map click navigation. */
  plazasByIbgeCode: PlazasByIbgeCode
  /** Zone plazas in scope (Salvador/Camaçari) with per-year values. */
  zoneBreakdown: PlazaZoneBreakdownRow[]
  candidateName: string
  comparison: PlazaMapComparison | null
}

export type ScopedPlaza = {
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
  geography: PlazaElectionGeography
}

type ScopedPlazaDoc = {
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

export const scopePlazasFromDocs = (docs: ReadonlyArray<ScopedPlazaDoc>): ScopedPlaza[] =>
  docs.flatMap((plaza) => {
    const entry = getPlazaCatalogEntry(plaza.slug)
    if (!entry) return []
    return [
      {
        id: plaza.id,
        slug: plaza.slug,
        name: plaza.name,
        kind: plaza.kind,
        ibgeCode: plaza.ibgeCode,
        expectedVotes: plaza.expectedVotes ?? null,
        geography: plazaElectionGeography(entry),
      },
    ]
  })

const loadScopedPlazas = async (
  payload: Payload,
  user: CampaignUser,
  state: PlazaListState,
): Promise<ScopedPlaza[]> => {
  const result = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { slug: true, name: true, kind: true, ibgeCode: true, expectedVotes: true },
    where: buildPlazaListWhere(state),
    user,
    overrideAccess: false,
  })

  return scopePlazasFromDocs(result.docs)
}

export const buildPlazaMapBundleFromPlazas = async (
  payload: Payload,
  user: CampaignUser,
  state: PlazaListState,
  plazas: ScopedPlaza[],
  pledgeAggregates: Map<number, PlazaPledgeAggregate>,
): Promise<PlazaMapBundle | null> => {
  if (plazas.length === 0) return null

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
    for (const plaza of plazas) {
      const votes = sumVotesForGeography(votesByCityZone, plaza.geography)
      values[plaza.ibgeCode] = (values[plaza.ibgeCode] ?? 0) + votes
      const valid = sumVotesForGeography(validByCityZone, plaza.geography)
      validValues[plaza.ibgeCode] = (validValues[plaza.ibgeCode] ?? 0) + valid
      if (plaza.kind === 'zona') {
        const bySlug = zoneVotesBySlug.get(plaza.slug) ?? {}
        bySlug[String(year)] = votes
        zoneVotesBySlug.set(plaza.slug, bySlug)
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

  for (const plaza of plazas) {
    const aggregate = pledgeAggregates.get(plaza.id) ?? emptyPlazaPledgeAggregate
    for (const scenario of VOTE_ESTIMATE_SCENARIOS) {
      const votes = resolvePlazaStaffVoteTotal(
        plaza.expectedVotes,
        aggregate.effectiveByScenario[scenario],
        scenario,
      )
      if (votes > 0) {
        pledgeValuesByScenario[scenario][plaza.ibgeCode] =
          (pledgeValuesByScenario[scenario][plaza.ibgeCode] ?? 0) + votes
      }
      if (plaza.kind === 'zona') {
        const byScenario = zoneVotes2026BySlug.get(plaza.slug) ?? emptyZoneScenarioVotes()
        byScenario[scenario] = votes
        zoneVotes2026BySlug.set(plaza.slug, byScenario)
        if (scenario === DEFAULT_VOTE_ESTIMATE_SCENARIO) {
          const bySlug = zoneVotesBySlug.get(plaza.slug) ?? {}
          bySlug['2026'] = votes
          zoneVotesBySlug.set(plaza.slug, bySlug)
        }
      }
    }
  }
  valuesByYear['2026'] = pledgeValuesByScenario[DEFAULT_VOTE_ESTIMATE_SCENARIO]

  const zoneBreakdown = plazas
    .filter((plaza) => plaza.kind === 'zona')
    .map((plaza) => ({
      slug: plaza.slug,
      name: plaza.name,
      votesByYear: zoneVotesBySlug.get(plaza.slug) ?? {},
      votes2026ByScenario: zoneVotes2026BySlug.get(plaza.slug) ?? emptyZoneScenarioVotes(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  let comparison: PlazaMapComparison | null = null
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
          for (const plaza of plazas) {
            const solla = sumVotesForGeography(sollaVotes, plaza.geography)
            const other = sumVotesForGeography(otherVotes, plaza.geography)
            values[plaza.ibgeCode] = (values[plaza.ibgeCode] ?? 0) + (solla - other)
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
    plazasByIbgeCode: buildPlazasByIbgeCode(plazas),
    zoneBreakdown,
    candidateName: BASELINE_TICKET_2022.candidate.name,
    comparison,
  }
}

/**
 * Map data for the Praças overview: plazas matching the list URL filters (and
 * role access) contribute their geography's votes (or 2026 pledge estimates)
 * to municipality polygons. When `state.compare` is set, TSE years also carry
 * a red↔white↔blue diff (Solla − other candidate).
 */
export const loadPlazaMapBundle = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: PlazaListSearchParams,
): Promise<PlazaMapBundle | null> => {
  if (user.role === 'leader') return null

  const state = parsePlazaListParams(searchParams)
  const plazas = await loadScopedPlazas(payload, user, state)
  if (plazas.length === 0) return null

  const pledgeAggregates = await aggregatePledgesByPlaza(
    payload,
    plazas.map((plaza) => plaza.id),
  )

  return buildPlazaMapBundleFromPlazas(payload, user, state, plazas, pledgeAggregates)
}
