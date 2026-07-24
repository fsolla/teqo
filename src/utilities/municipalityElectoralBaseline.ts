import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
  HISTORICAL_SERIES_YEARS,
} from '@/lib/electionResults'
import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { ELECTION_TSE_CACHE_TAG } from '@/utilities/electionCache'
import {
  municipalityGeographyWhere,
  type MunicipalityElectionGeography,
} from '@/utilities/municipalityElectionGeography'

type ElectionReader = CampaignUser | User

export type MunicipalityVoteSeriesPoint = {
  year: number
  votes: number
}

export type MunicipalityElectoralBaseline = {
  candidateName: string
  candidateParty: string
  series: MunicipalityVoteSeriesPoint[]
  tally2022: {
    aptos: number
    comparecimento: number
    votosValidos: number
  } | null
  ticket2022: {
    president: number | null
    governor: number | null
  }
}

/**
 * Cross-request cached core — the TSE collections are immutable, so entries
 * live until the `election-tse` tag is busted after a re-seed. The geography
 * argument is part of the cache key (JSON-serialized by `unstable_cache`).
 */
const loadMunicipalityElectoralBaselineCached = unstable_cache(
  async (
    geography: MunicipalityElectionGeography,
  ): Promise<MunicipalityElectoralBaseline | null> => {
    const payload = await getPayload({ config: configPromise })
    return queryMunicipalityElectoralBaseline(payload, geography)
  },
  ['municipality-electoral-baseline'],
  { tags: [ELECTION_TSE_CACHE_TAG] },
)

/**
 * Candidate (Solla) vote series 2014/2018/2022 + 2022 turnout inside the
 * municipality geography, plus 2022 president/governor ticket votes.
 */
export const loadMunicipalityElectoralBaseline = (
  user: ElectionReader,
  geography: MunicipalityElectionGeography,
): Promise<MunicipalityElectoralBaseline | null> => {
  assertCanReadElectionData(user)
  return loadMunicipalityElectoralBaselineCached(geography)
}

const queryMunicipalityElectoralBaseline = async (
  payload: Payload,
  geography: MunicipalityElectionGeography,
): Promise<MunicipalityElectoralBaseline | null> => {
  const [candidateVotes, tallies, presidentVotes, governorVotes] = await Promise.all([
    payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [
          { year: { in: [...HISTORICAL_SERIES_YEARS] } },
          { office: { equals: BASELINE_TICKET_2022.candidate.office } },
          { turn: { equals: '1' } },
          { voteType: { equals: 'nominal' } },
          { candidateNumber: { equals: BASELINE_TICKET_2022.candidate.candidateNumber } },
          municipalityGeographyWhere(geography),
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { year: true, votes: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'electionTally',
      where: {
        and: [
          { year: { equals: ELECTION_YEAR_2022 } },
          { office: { equals: BASELINE_TICKET_2022.candidate.office } },
          { turn: { equals: '1' } },
          municipalityGeographyWhere(geography),
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { aptos: true, comparecimento: true, votosValidos: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [
          { year: { equals: ELECTION_YEAR_2022 } },
          { office: { equals: 'presidente' } },
          { turn: { equals: '1' } },
          { voteType: { equals: 'nominal' } },
          { candidateNumber: { equals: BASELINE_TICKET_2022.president.candidateNumber } },
          municipalityGeographyWhere(geography),
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { votes: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'electionCandidateVote',
      where: {
        and: [
          { year: { equals: ELECTION_YEAR_2022 } },
          { office: { equals: 'governador' } },
          { turn: { equals: '1' } },
          { voteType: { equals: 'nominal' } },
          { candidateNumber: { equals: BASELINE_TICKET_2022.governor.candidateNumber } },
          municipalityGeographyWhere(geography),
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { votes: true },
      overrideAccess: true,
    }),
  ])

  const votesByYear = new Map<number, number>()
  for (const row of candidateVotes.docs) {
    votesByYear.set(row.year, (votesByYear.get(row.year) ?? 0) + (row.votes ?? 0))
  }

  const hasAnyData = candidateVotes.docs.length > 0 || tallies.docs.length > 0
  if (!hasAnyData) return null

  const tally2022 = tallies.docs.length
    ? tallies.docs.reduce(
        (accumulator, row) => ({
          aptos: accumulator.aptos + (row.aptos ?? 0),
          comparecimento: accumulator.comparecimento + (row.comparecimento ?? 0),
          votosValidos: accumulator.votosValidos + (row.votosValidos ?? 0),
        }),
        { aptos: 0, comparecimento: 0, votosValidos: 0 },
      )
    : null

  const sumVotes = (docs: Array<{ votes?: number | null }>): number | null =>
    docs.length ? docs.reduce((total, row) => total + (row.votes ?? 0), 0) : null

  return {
    candidateName: BASELINE_TICKET_2022.candidate.name,
    candidateParty: BASELINE_TICKET_2022.candidate.party,
    series: [...HISTORICAL_SERIES_YEARS].map((year) => ({
      year,
      votes: votesByYear.get(year) ?? 0,
    })),
    tally2022,
    ticket2022: {
      president: sumVotes(presidentVotes.docs),
      governor: sumVotes(governorVotes.docs),
    },
  }
}

export type CandidateVotesByCity = Map<string, number>

/**
 * Statewide nominal votes of one federal-deputy candidate in one year, grouped
 * by TSE cityCode. Used by the Praças map (choropleth per municipality).
 */
export const loadCandidateVotesByCity = async (
  payload: Payload,
  user: ElectionReader,
  { year, candidateNumber }: { year: number; candidateNumber: number },
): Promise<CandidateVotesByCity> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { equals: year } },
        { office: { equals: FEDERAL_DEPUTY_OFFICE } },
        { turn: { equals: '1' } },
        { voteType: { equals: 'nominal' } },
        { candidateNumber: { equals: candidateNumber } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { cityCode: true, votes: true },
    overrideAccess: true,
  })

  const votesByCity: CandidateVotesByCity = new Map()
  for (const row of result.docs) {
    votesByCity.set(row.cityCode, (votesByCity.get(row.cityCode) ?? 0) + (row.votes ?? 0))
  }
  return votesByCity
}

/**
 * Nominal votes of one federal-deputy candidate inside a set of municipality
 * geographies (per municipality slug), for the selected year.
 */
export const sumVotesForGeography = (
  votesByCityZone: Map<string, number>,
  geography: MunicipalityElectionGeography,
): number => {
  let total = 0
  for (const zone of geography.zones) {
    total += votesByCityZone.get(`${geography.cityCode}:${zone}`) ?? 0
  }
  return total
}

/** cityCode:zone → votosValidos map for one year (federal T1 tally). */
export const loadValidVotesByCityZone = async (
  payload: Payload,
  user: ElectionReader,
  { year }: { year: number },
): Promise<Map<string, number>> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionTally',
    where: {
      and: [
        { year: { equals: year } },
        { office: { equals: FEDERAL_DEPUTY_OFFICE } },
        { turn: { equals: '1' } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { cityCode: true, zoneNumber: true, votosValidos: true },
    overrideAccess: true,
  })

  const validVotes = new Map<string, number>()
  for (const row of result.docs) {
    const key = `${row.cityCode}:${row.zoneNumber}`
    validVotes.set(key, (validVotes.get(key) ?? 0) + (row.votosValidos ?? 0))
  }
  return validVotes
}

/** cityCode:zone → votes map for one candidate/year (municipality-level slicing). */
export const loadCandidateVotesByCityZone = async (
  payload: Payload,
  user: ElectionReader,
  { year, candidateNumber }: { year: number; candidateNumber: number },
): Promise<Map<string, number>> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { equals: year } },
        { office: { equals: FEDERAL_DEPUTY_OFFICE } },
        { turn: { equals: '1' } },
        { voteType: { equals: 'nominal' } },
        { candidateNumber: { equals: candidateNumber } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { cityCode: true, zoneNumber: true, votes: true },
    overrideAccess: true,
  })

  const votes = new Map<string, number>()
  for (const row of result.docs) {
    const key = `${row.cityCode}:${row.zoneNumber}`
    votes.set(key, (votes.get(key) ?? 0) + (row.votes ?? 0))
  }
  return votes
}
