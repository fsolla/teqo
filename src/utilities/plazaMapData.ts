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
  sumVotesForGeography,
} from '@/utilities/plazaElectoralBaseline'
import {
  aggregatePledgesByPlaza,
  emptyPlazaPledgeAggregate,
  resolvePlazaStaffVoteTotal,
} from '@/utilities/votePledgeData'

export const PLAZA_MAP_YEARS = [...HISTORICAL_SERIES_YEARS, 2026] as const
export type PlazaMapYear = (typeof PLAZA_MAP_YEARS)[number]

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
}

export type PlazaMapComparison = {
  candidateNumber: number
  candidateName: string
  /** TSE year (as string) → codarea → (sollaVotes − otherVotes). */
  diffByYear: Record<string, Record<string, number>>
}

export type PlazaMapBundle = {
  /** year (as string) → codarea → value. 2026 = expectedVotes ?? pledge effective total. */
  valuesByYear: Record<string, Record<string, number>>
  /** Zone plazas in scope (Salvador/Camaçari) with per-year values. */
  zoneBreakdown: PlazaZoneBreakdownRow[]
  candidateName: string
  comparison: PlazaMapComparison | null
}

type ScopedPlaza = {
  id: number
  slug: string
  name: string
  kind: 'municipio' | 'zona'
  ibgeCode: string
  expectedVotes: number | null
  geography: PlazaElectionGeography
}

const loadScopedPlazas = async (payload: Payload, user: CampaignUser): Promise<ScopedPlaza[]> => {
  const result = await payload.find({
    collection: 'plaza',
    depth: 0,
    limit: 0,
    pagination: false,
    select: { slug: true, name: true, kind: true, ibgeCode: true, expectedVotes: true },
    where: {},
    user,
    overrideAccess: false,
  })

  return result.docs.flatMap((plaza) => {
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
}

/**
 * Map data for the Praças overview: every accessible plaza contributes its
 * geography's votes (or 2026 pledge estimates) to its municipality polygon.
 * An advisor therefore sees only their plazas' share shaded on the map. When
 * `compareCandidateNumber` is set, TSE years also carry a red↔white↔blue
 * diff (Solla − other candidate).
 */
export const loadPlazaMapBundle = async (
  payload: Payload,
  user: CampaignUser,
  compareCandidateNumber?: number,
): Promise<PlazaMapBundle | null> => {
  if (user.role === 'leader') return null

  const plazas = await loadScopedPlazas(payload, user)
  if (plazas.length === 0) return null

  const valuesByYear: Record<string, Record<string, number>> = {}
  const zoneVotesBySlug = new Map<string, Record<string, number>>()
  const sollaVotesByYear = new Map<number, Map<string, number>>()

  for (const year of HISTORICAL_SERIES_YEARS) {
    const votesByCityZone = await loadCandidateVotesByCityZone(payload, user, {
      year,
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
    })
    sollaVotesByYear.set(year, votesByCityZone)
    const values: Record<string, number> = {}
    for (const plaza of plazas) {
      const votes = sumVotesForGeography(votesByCityZone, plaza.geography)
      values[plaza.ibgeCode] = (values[plaza.ibgeCode] ?? 0) + votes
      if (plaza.kind === 'zona') {
        const bySlug = zoneVotesBySlug.get(plaza.slug) ?? {}
        bySlug[String(year)] = votes
        zoneVotesBySlug.set(plaza.slug, bySlug)
      }
    }
    valuesByYear[String(year)] = values
  }

  const pledgeAggregates = await aggregatePledgesByPlaza(
    payload,
    plazas.map((plaza) => plaza.id),
  )
  const pledgeValues: Record<string, number> = {}
  for (const plaza of plazas) {
    const aggregate = pledgeAggregates.get(plaza.id) ?? emptyPlazaPledgeAggregate
    const votes = resolvePlazaStaffVoteTotal(plaza.expectedVotes, aggregate.effectiveTotal)
    if (votes > 0) pledgeValues[plaza.ibgeCode] = (pledgeValues[plaza.ibgeCode] ?? 0) + votes
    if (plaza.kind === 'zona') {
      const bySlug = zoneVotesBySlug.get(plaza.slug) ?? {}
      bySlug['2026'] = votes
      zoneVotesBySlug.set(plaza.slug, bySlug)
    }
  }
  valuesByYear['2026'] = pledgeValues

  const zoneBreakdown = plazas
    .filter((plaza) => plaza.kind === 'zona')
    .map((plaza) => ({
      slug: plaza.slug,
      name: plaza.name,
      votesByYear: zoneVotesBySlug.get(plaza.slug) ?? {},
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  let comparison: PlazaMapComparison | null = null
  if (compareCandidateNumber) {
    const candidates = await payload.find({
      collection: 'electionCandidate',
      where: {
        and: [
          { candidateNumber: { equals: compareCandidateNumber } },
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
      for (const year of HISTORICAL_SERIES_YEARS) {
        const otherVotes = await loadCandidateVotesByCityZone(payload, user, {
          year,
          candidateNumber: compareCandidateNumber,
        })
        const sollaVotes = sollaVotesByYear.get(year) ?? new Map<string, number>()
        const values: Record<string, number> = {}
        for (const plaza of plazas) {
          const solla = sumVotesForGeography(sollaVotes, plaza.geography)
          const other = sumVotesForGeography(otherVotes, plaza.geography)
          values[plaza.ibgeCode] = (values[plaza.ibgeCode] ?? 0) + (solla - other)
        }
        diffByYear[String(year)] = values
      }

      comparison = {
        candidateNumber: compareCandidateNumber,
        candidateName: `${candidate.urnaName}${candidate.party ? ` (${candidate.party})` : ''}`,
        diffByYear,
      }
    }
  }

  return {
    valuesByYear,
    zoneBreakdown,
    candidateName: BASELINE_TICKET_2022.candidate.name,
    comparison,
  }
}
