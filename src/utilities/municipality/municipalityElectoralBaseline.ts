import 'server-only'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'

import type { FederalBaselineTallyCell } from '@/lib/bahiaElectionAggregates'
import { isCampoParty } from '@/lib/campoParties'
import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
  HISTORICAL_SERIES_YEARS,
  type ElectionOffice,
  type ElectionTurn,
} from '@/lib/electionResults'
import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { ELECTION_TSE_CACHE_TAG } from '@/utilities/electionCache'
import {
  municipalityGeographyWhere,
  type MunicipalityElectionGeography,
} from '@/utilities/municipality/municipalityElectionGeography'

type ElectionReader = CampaignUser | User

type MunicipalityVoteSeriesPoint = {
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

/**
 * cityCode:zone → votes map for one candidate/year (municipality-level
 * slicing). Defaults to deputado-federal T1 for the existing map/E2 callers;
 * E8's "teto do campo" passes `office`/`turn` explicitly to slice
 * presidente/governador instead.
 */
export const loadCandidateVotesByCityZone = async (
  payload: Payload,
  user: ElectionReader,
  {
    year,
    candidateNumber,
    office = FEDERAL_DEPUTY_OFFICE,
    turn = '1',
  }: { year: number; candidateNumber: number; office?: ElectionOffice; turn?: ElectionTurn },
): Promise<Map<string, number>> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { equals: year } },
        { office: { equals: office } },
        { turn: { equals: turn } },
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

/**
 * cityCode:zone → sum of nominal deputado-federal T1 votes for every
 * candidate whose party is in the curated `campoParties.ts` field for that
 * year (E8 "share intracampo" denominator — CLI/build-time use only, this
 * scans the whole statewide slice for the office).
 */
export const loadCampoFederalVotesByCityZone = async (
  payload: Payload,
  user: ElectionReader,
  { year }: { year: number },
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
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { cityCode: true, zoneNumber: true, party: true, votes: true },
    overrideAccess: true,
  })

  const votes = new Map<string, number>()
  for (const row of result.docs) {
    if (!isCampoParty(row.party, year)) continue
    const key = `${row.cityCode}:${row.zoneNumber}`
    votes.set(key, (votes.get(key) ?? 0) + (row.votes ?? 0))
  }
  return votes
}

/**
 * cityCode:zone → (candidateNumber → nominal deputado-federal T1 votes) for
 * one year — the whole statewide slice, ungrouped by candidate, so a caller
 * can fold it over any municipality geography and rank candidates against
 * each other (B13's "posição no município").
 *
 * CLI/build-time use only, same as `loadCampoFederalVotesByCityZone`: this
 * scans ~100k rows and must never run on a request path — the ranking it
 * feeds is precomputed into the committed artifact.
 */
export const loadFederalVotesByCityZoneAndCandidate = async (
  payload: Payload,
  user: ElectionReader,
  { year }: { year: number },
): Promise<Map<string, Map<number, number>>> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { equals: year } },
        { office: { equals: FEDERAL_DEPUTY_OFFICE } },
        { turn: { equals: '1' } },
        { voteType: { equals: 'nominal' } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { cityCode: true, zoneNumber: true, candidateNumber: true, votes: true },
    overrideAccess: true,
  })

  const byCityZone = new Map<string, Map<number, number>>()
  for (const row of result.docs) {
    const key = `${row.cityCode}:${row.zoneNumber}`
    let byCandidate = byCityZone.get(key)
    if (!byCandidate) {
      byCandidate = new Map<number, number>()
      byCityZone.set(key, byCandidate)
    }
    byCandidate.set(
      row.candidateNumber,
      (byCandidate.get(row.candidateNumber) ?? 0) + (row.votes ?? 0),
    )
  }
  return byCityZone
}

/** Folds `loadFederalVotesByCityZoneAndCandidate` over one municipality's cityCode×zones. */
export const sumCandidateVotesForGeography = (
  votesByCityZoneAndCandidate: Map<string, Map<number, number>>,
  geography: MunicipalityElectionGeography,
): Map<number, number> => {
  const total = new Map<number, number>()
  for (const zone of geography.zones) {
    const byCandidate = votesByCityZoneAndCandidate.get(`${geography.cityCode}:${zone}`)
    if (!byCandidate) continue
    for (const [candidateNumber, votes] of byCandidate) {
      total.set(candidateNumber, (total.get(candidateNumber) ?? 0) + votes)
    }
  }
  return total
}

/** Turnout/valid/blank/null tally cell — same shape the committed artifact stores per year. */
export type OfficeTallyCell = FederalBaselineTallyCell

/**
 * cityCode:zone → turnout/valid/blank/null tally for one office×year×turn
 * (used for the roll-off diagnostic: DF tally vs. majoritarian tally in the
 * same cell — CLI/build-time use only).
 */
export const loadOfficeTallyByCityZone = async (
  payload: Payload,
  user: ElectionReader,
  { year, office, turn }: { year: number; office: ElectionOffice; turn: ElectionTurn },
): Promise<Map<string, OfficeTallyCell>> => {
  assertCanReadElectionData(user)

  const result = await payload.find({
    collection: 'electionTally',
    where: {
      and: [{ year: { equals: year } }, { office: { equals: office } }, { turn: { equals: turn } }],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      cityCode: true,
      zoneNumber: true,
      comparecimento: true,
      votosValidos: true,
      votosBranco: true,
      votosNulo: true,
    },
    overrideAccess: true,
  })

  const tally = new Map<string, OfficeTallyCell>()
  for (const row of result.docs) {
    const key = `${row.cityCode}:${row.zoneNumber}`
    const current = tally.get(key) ?? {
      comparecimento: 0,
      votosValidos: 0,
      votosBranco: 0,
      votosNulo: 0,
    }
    tally.set(key, {
      comparecimento: current.comparecimento + (row.comparecimento ?? 0),
      votosValidos: current.votosValidos + (row.votosValidos ?? 0),
      votosBranco: current.votosBranco + (row.votosBranco ?? 0),
      votosNulo: current.votosNulo + (row.votosNulo ?? 0),
    })
  }
  return tally
}

/** Sums an `OfficeTallyCell` map over a municipality's cityCode×zones. */
export const sumOfficeTallyForGeography = (
  tallyByCityZone: Map<string, OfficeTallyCell>,
  geography: MunicipalityElectionGeography,
): OfficeTallyCell => {
  const total: OfficeTallyCell = {
    comparecimento: 0,
    votosValidos: 0,
    votosBranco: 0,
    votosNulo: 0,
  }
  for (const zone of geography.zones) {
    const cell = tallyByCityZone.get(`${geography.cityCode}:${zone}`)
    if (!cell) continue
    total.comparecimento += cell.comparecimento
    total.votosValidos += cell.votosValidos
    total.votosBranco += cell.votosBranco
    total.votosNulo += cell.votosNulo
  }
  return total
}
