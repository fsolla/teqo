import type { Payload } from 'payload'

import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
  HISTORICAL_SERIES_YEARS,
} from '@/lib/electionResults'
import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import {
  plazaGeographyWhere,
  type PlazaElectionGeography,
} from '@/utilities/plazaElectionGeography'

export const MAX_COMPARISON_CANDIDATES = 5

export type CandidateComparisonRow = {
  candidateNumber: number
  name: string
  party: string | null
  isReference: boolean
  votesByYear: Record<string, number>
}

/**
 * Vote comparison between Jorge Solla and selected federal-deputy candidates
 * inside one plaza geography, across the TSE series years. This is the
 * coordination's core analysis tool ("com quem comparar nesta Praça?").
 */
export const loadPlazaCandidateComparison = async (
  payload: Payload,
  user: CampaignUser | User,
  geography: PlazaElectionGeography,
  compareCandidateNumbers: number[],
): Promise<CandidateComparisonRow[]> => {
  assertCanReadElectionData(user)

  const candidateNumbers = [
    BASELINE_TICKET_2022.candidate.candidateNumber,
    ...compareCandidateNumbers
      .filter((number) => number !== BASELINE_TICKET_2022.candidate.candidateNumber)
      .slice(0, MAX_COMPARISON_CANDIDATES),
  ]

  const [votes, registry] = await Promise.all([
    payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [
          { year: { in: [...HISTORICAL_SERIES_YEARS] } },
          { office: { equals: FEDERAL_DEPUTY_OFFICE } },
          { turn: { equals: '1' } },
          { voteType: { equals: 'nominal' } },
          { candidateNumber: { in: candidateNumbers } },
          plazaGeographyWhere(geography),
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { year: true, candidateNumber: true, candidateName: true, party: true, votes: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'electionCandidate',
      where: {
        and: [
          { year: { equals: ELECTION_YEAR_2022 } },
          { office: { equals: FEDERAL_DEPUTY_OFFICE } },
          { turn: { equals: '1' } },
          { candidateNumber: { in: candidateNumbers } },
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { candidateNumber: true, urnaName: true, party: true },
      overrideAccess: true,
    }),
  ])

  const registryByNumber = new Map(
    registry.docs.map((candidate) => [candidate.candidateNumber, candidate]),
  )
  const fallbackNameByNumber = new Map<number, { name: string; party: string | null }>()
  const votesByCandidateYear = new Map<number, Map<number, number>>()
  for (const row of votes.docs) {
    const byYear = votesByCandidateYear.get(row.candidateNumber) ?? new Map<number, number>()
    byYear.set(row.year, (byYear.get(row.year) ?? 0) + (row.votes ?? 0))
    votesByCandidateYear.set(row.candidateNumber, byYear)
    if (!fallbackNameByNumber.has(row.candidateNumber)) {
      fallbackNameByNumber.set(row.candidateNumber, {
        name: row.candidateName,
        party: row.party ?? null,
      })
    }
  }

  return candidateNumbers.map((candidateNumber) => {
    const registryEntry = registryByNumber.get(candidateNumber)
    const fallback = fallbackNameByNumber.get(candidateNumber)
    const byYear = votesByCandidateYear.get(candidateNumber) ?? new Map<number, number>()
    const isReference = candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber

    const votesByYear: Record<string, number> = {}
    for (const year of HISTORICAL_SERIES_YEARS) {
      votesByYear[String(year)] = byYear.get(year) ?? 0
    }

    return {
      candidateNumber,
      name: isReference
        ? BASELINE_TICKET_2022.candidate.name
        : (registryEntry?.urnaName ?? fallback?.name ?? `Candidato ${candidateNumber}`),
      party: isReference
        ? BASELINE_TICKET_2022.candidate.party
        : (registryEntry?.party ?? fallback?.party ?? null),
      isReference,
      votesByYear,
    }
  })
}
