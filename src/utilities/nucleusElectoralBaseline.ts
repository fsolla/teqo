import type { Payload, Where } from 'payload'

import { citiesForTerritory, isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  type ElectionOffice,
  type ElectionTurn,
} from '@/lib/electionResults'
import type { CampaignUser, User } from '@/payload-types'
import { normalizeTerritoryTextArray } from '@/utilities/campaignTerritoryValidation'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'
import { sortedUniqueZoneNumbers } from '@/utilities/tseZone'

const CANDIDATE_OFFICE = BASELINE_TICKET_2022.candidate.office

export type NucleusElectionGeographyInput = {
  cities: string[]
  regions: string[]
  tseZones: number[]
}

export const toNucleusElectionGeographyInput = (nucleus: {
  cities?: string[] | null
  regions?: string[] | null
  tseZones?: Array<number | { zoneNumber: number }> | null
}): NucleusElectionGeographyInput => ({
  cities: normalizeTerritoryTextArray(nucleus.cities),
  regions: normalizeTerritoryTextArray(nucleus.regions),
  tseZones: (nucleus.tseZones ?? []).map((zone) =>
    typeof zone === 'number' ? zone : zone.zoneNumber,
  ),
})

export type NucleusElectionGeography = {
  cities: string[]
  zonesByCity: Map<string, number[]>
  cityZonePairs: Array<{ cityName: string; zoneNumber: number }>
}

export type ElectionVoteAggregateRow = {
  office: ElectionOffice
  turn: ElectionTurn
  cityName: string
  zoneNumber: number
  candidateNumber: number
  candidateName: string
  party: string
  votes: number
}

export type ElectionTallyAggregateRow = {
  office: ElectionOffice
  turn: ElectionTurn
  cityName: string
  zoneNumber: number
  aptos: number
  votosValidos: number
  votosBranco: number
  votosNulo: number
  abstencoes: number
}

type ElectionReader = CampaignUser | User

const cityZoneKey = (cityName: string, zoneNumber: number): string =>
  `${cityName}::${zoneNumber}`

const uniqueSortedCities = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, 'pt-BR'))

/**
 * Resolve the effective city×zone geography for a nucleus baseline query.
 * Returns null when the nucleus has no usable territory (no cities and no regions).
 *
 * Zone rules per city:
 * - nucleus.tseZones empty → all official zones of the city (`tseZonesForCity`)
 * - nucleus.tseZones non-empty → intersection with the city's official zones;
 *   if the intersection is empty (typed zones outside the city), fall back to all city zones
 */
export const resolveNucleusElectionGeography = (
  nucleus: NucleusElectionGeographyInput,
): NucleusElectionGeography | null => {
  const citiesFromNucleus = uniqueSortedCities(nucleus.cities.filter((city) => city.length > 0))
  const cities =
    citiesFromNucleus.length > 0
      ? citiesFromNucleus
      : uniqueSortedCities(
          nucleus.regions.flatMap((region) =>
            isBahiaIdentityTerritory(region) ? citiesForTerritory(region) : [],
          ),
        )

  if (cities.length === 0) return null

  const requestedZones = sortedUniqueZoneNumbers(
    nucleus.tseZones.filter((zone) => Number.isInteger(zone) && zone >= 1 && zone <= 999),
  )

  const zonesByCity = new Map<string, number[]>()
  const cityZonePairs: Array<{ cityName: string; zoneNumber: number }> = []

  for (const city of cities) {
    const cityZones = [...tseZonesForCity(city)]
    let effectiveZones = cityZones
    if (requestedZones.length > 0) {
      const cityZoneSet = new Set(cityZones)
      const intersection = requestedZones.filter((zone) => cityZoneSet.has(zone))
      if (intersection.length > 0) effectiveZones = intersection
    }

    if (effectiveZones.length === 0) continue

    zonesByCity.set(city, effectiveZones)
    for (const zoneNumber of effectiveZones) {
      cityZonePairs.push({ cityName: city, zoneNumber })
    }
  }

  if (cityZonePairs.length === 0) return null

  return { cities: [...zonesByCity.keys()], zonesByCity, cityZonePairs }
}

const matchesGeography = (
  row: { cityName: string; zoneNumber: number },
  geography: NucleusElectionGeography,
): boolean => {
  const zones = geography.zonesByCity.get(row.cityName)
  return Boolean(zones?.includes(row.zoneNumber))
}

const sumCandidateVotes = (
  votes: readonly ElectionVoteAggregateRow[],
  geography: NucleusElectionGeography,
  office: ElectionOffice,
  turn: ElectionTurn,
  candidateNumber: number,
): number =>
  votes
    .filter(
      (row) =>
        row.office === office &&
        row.turn === turn &&
        row.candidateNumber === candidateNumber &&
        matchesGeography(row, geography),
    )
    .reduce((sum, row) => sum + row.votes, 0)

const decisiveTicketVotes = (
  votes: readonly ElectionVoteAggregateRow[],
  geography: NucleusElectionGeography,
  office: 'presidente' | 'governador',
  candidateNumber: number,
): { votes: number; turn: 1 | 2 } | null => {
  const turn2 = sumCandidateVotes(votes, geography, office, '2', candidateNumber)
  if (turn2 > 0) return { votes: turn2, turn: 2 }
  const turn1 = sumCandidateVotes(votes, geography, office, '1', candidateNumber)
  if (turn1 > 0) return { votes: turn1, turn: 1 }
  return null
}

const aggregateFederalCandidateTotals = (
  votes: readonly ElectionVoteAggregateRow[],
  geography: NucleusElectionGeography,
): Array<{ candidateNumber: number; name: string; party: string; votes: number }> => {
  const byCandidate = new Map<
    number,
    { candidateNumber: number; name: string; party: string; votes: number }
  >()

  for (const row of votes) {
    if (row.office !== CANDIDATE_OFFICE || row.turn !== '1') continue
    if (!matchesGeography(row, geography)) continue

    const existing = byCandidate.get(row.candidateNumber)
    if (existing) {
      existing.votes += row.votes
      continue
    }
    byCandidate.set(row.candidateNumber, {
      candidateNumber: row.candidateNumber,
      name: row.candidateName,
      party: row.party,
      votes: row.votes,
    })
  }

  return [...byCandidate.values()].sort((left, right) => {
    if (right.votes !== left.votes) return right.votes - left.votes
    return left.candidateNumber - right.candidateNumber
  })
}

const aggregateElectorate = (
  tallies: readonly ElectionTallyAggregateRow[],
  geography: NucleusElectionGeography,
): NucleusElectoralBaselineViewModel['electorate'] => {
  let aptos = 0
  let validos = 0
  let brancos = 0
  let nulos = 0
  let abstencoes = 0

  for (const row of tallies) {
    if (row.office !== CANDIDATE_OFFICE || row.turn !== '1') continue
    if (!matchesGeography(row, geography)) continue
    aptos += row.aptos
    validos += row.votosValidos
    brancos += row.votosBranco
    nulos += row.votosNulo
    abstencoes += row.abstencoes
  }

  return { aptos, validos, brancos, nulos, abstencoes }
}

export const aggregateNucleusElectoralBaseline = (
  geography: NucleusElectionGeography,
  votes: readonly ElectionVoteAggregateRow[],
  tallies: readonly ElectionTallyAggregateRow[],
): NucleusElectoralBaselineViewModel => {
  const federalTotals = aggregateFederalCandidateTotals(votes, geography)
  const candidateIndex = federalTotals.findIndex(
    (candidate) => candidate.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber,
  )
  const candidateRow = federalTotals[candidateIndex]
  const winner = federalTotals[0] ?? null

  return {
    candidate: {
      votes: candidateRow?.votes ?? 0,
      rank: candidateIndex >= 0 ? candidateIndex + 1 : null,
    },
    president: decisiveTicketVotes(
      votes,
      geography,
      'presidente',
      BASELINE_TICKET_2022.president.candidateNumber,
    ),
    governor: decisiveTicketVotes(
      votes,
      geography,
      'governador',
      BASELINE_TICKET_2022.governor.candidateNumber,
    ),
    electorate: aggregateElectorate(tallies, geography),
    winnerFederal: winner
      ? { name: winner.name, votes: winner.votes, party: winner.party }
      : null,
  }
}

const ba2022Scope = (): Where[] => [
  { year: { equals: ELECTION_YEAR_2022 } },
  { state: { equals: 'BA' } },
]

/** One clause per city with `zoneNumber in […]` — avoids an OR per city×zone pair. */
const geographyWhere = (geography: NucleusElectionGeography): Where => ({
  or: [...geography.zonesByCity.entries()].map(
    ([cityName, zones]): Where => ({
      and: [{ cityName: { equals: cityName } }, { zoneNumber: { in: zones } }],
    }),
  ),
})

/** Votes for the detail baseline card (federal ranking + president/governor tickets). */
const detailVoteWhere = (geography: NucleusElectionGeography): Where => ({
  and: [
    ...ba2022Scope(),
    { voteType: { equals: 'nominal' } },
    geographyWhere(geography),
    {
      or: [
        {
          and: [{ office: { equals: CANDIDATE_OFFICE } }, { turn: { equals: '1' } }],
        },
        {
          and: [
            { office: { equals: 'presidente' } },
            { candidateNumber: { equals: BASELINE_TICKET_2022.president.candidateNumber } },
          ],
        },
        {
          and: [
            { office: { equals: 'governador' } },
            { candidateNumber: { equals: BASELINE_TICKET_2022.governor.candidateNumber } },
          ],
        },
      ],
    },
  ],
})

const loadElectionVotes = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionReader,
  geography: NucleusElectionGeography,
): Promise<ElectionVoteAggregateRow[]> => {
  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: detailVoteWhere(geography),
    depth: 0,
    pagination: false,
    select: {
      office: true,
      turn: true,
      cityName: true,
      zoneNumber: true,
      candidateNumber: true,
      candidateName: true,
      party: true,
      votes: true,
    },
    user,
    overrideAccess: false,
  })

  return result.docs.map((doc) => ({
    office: doc.office,
    turn: doc.turn,
    cityName: doc.cityName,
    zoneNumber: doc.zoneNumber,
    candidateNumber: doc.candidateNumber,
    candidateName: doc.candidateName,
    party: doc.party ?? '',
    votes: doc.votes,
  }))
}

const loadElectionTallies = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionReader,
  geography: NucleusElectionGeography,
): Promise<ElectionTallyAggregateRow[]> => {
  const result = await payload.find({
    collection: 'electionTally',
    where: {
      and: [
        ...ba2022Scope(),
        { office: { equals: CANDIDATE_OFFICE } },
        { turn: { equals: '1' } },
        geographyWhere(geography),
      ],
    },
    depth: 0,
    pagination: false,
    select: {
      office: true,
      turn: true,
      cityName: true,
      zoneNumber: true,
      aptos: true,
      votosValidos: true,
      votosBranco: true,
      votosNulo: true,
      abstencoes: true,
    },
    user,
    overrideAccess: false,
  })

  return result.docs.map((doc) => ({
    office: doc.office,
    turn: doc.turn,
    cityName: doc.cityName,
    zoneNumber: doc.zoneNumber,
    aptos: doc.aptos,
    votosValidos: doc.votosValidos,
    votosBranco: doc.votosBranco,
    votosNulo: doc.votosNulo,
    abstencoes: doc.abstencoes,
  }))
}

/** Overview Gap: campaign candidate 1º-turno votes indexed by city×zone. */
const loadCandidateVotesByCityZone = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionReader,
  geography: NucleusElectionGeography,
): Promise<Map<string, number>> => {
  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        ...ba2022Scope(),
        { voteType: { equals: 'nominal' } },
        { office: { equals: CANDIDATE_OFFICE } },
        { turn: { equals: '1' } },
        { candidateNumber: { equals: BASELINE_TICKET_2022.candidate.candidateNumber } },
        geographyWhere(geography),
      ],
    },
    depth: 0,
    pagination: false,
    select: {
      cityName: true,
      zoneNumber: true,
      votes: true,
    },
    user,
    overrideAccess: false,
  })

  const byCityZone = new Map<string, number>()
  for (const doc of result.docs) {
    const key = cityZoneKey(doc.cityName, doc.zoneNumber)
    byCityZone.set(key, (byCityZone.get(key) ?? 0) + doc.votes)
  }
  return byCityZone
}

const sumCandidateVotesForGeography = (
  geography: NucleusElectionGeography,
  candidateVotesByCityZone: ReadonlyMap<string, number>,
): number =>
  geography.cityZonePairs.reduce(
    (sum, { cityName, zoneNumber }) =>
      sum + (candidateVotesByCityZone.get(cityZoneKey(cityName, zoneNumber)) ?? 0),
    0,
  )

export const getNucleusElectoralBaseline = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionReader,
  nucleus: NucleusElectionGeographyInput,
): Promise<NucleusElectoralBaselineViewModel | null> => {
  const geography = resolveNucleusElectionGeography(nucleus)
  if (!geography) return null

  const [votes, tallies] = await Promise.all([
    loadElectionVotes(payload, user, geography),
    loadElectionTallies(payload, user, geography),
  ])

  return aggregateNucleusElectoralBaseline(geography, votes, tallies)
}

export type NucleusBaseline2022OverviewInput = NucleusElectionGeographyInput & {
  confirmedVoteEstimate: number | null
}

export type NucleusBaseline2022OverviewAggregate = {
  gapTotal: number | null
  above: number
  below: number
}

/**
 * Aggregate Gap vs 2022 over a filtered nucleus set.
 * One candidate-only vote query for the union geography, then O(pairs) sums per nucleus.
 */
export const loadNucleusBaseline2022Overview = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionReader,
  nuclei: readonly NucleusBaseline2022OverviewInput[],
): Promise<NucleusBaseline2022OverviewAggregate | null> => {
  const geographies = nuclei.map((nucleus) => resolveNucleusElectionGeography(nucleus))
  const comparableIndexes: number[] = []

  for (let index = 0; index < nuclei.length; index += 1) {
    if (!geographies[index]) continue
    if (nuclei[index]?.confirmedVoteEstimate == null) continue
    comparableIndexes.push(index)
  }

  // Geography exists but nothing to compare — keep the "—" card without a TSE query.
  if (comparableIndexes.length === 0) {
    return geographies.some(Boolean) ? { gapTotal: null, above: 0, below: 0 } : null
  }

  const unionPairs = new Map<string, { cityName: string; zoneNumber: number }>()
  const zonesByCity = new Map<string, number[]>()

  for (const index of comparableIndexes) {
    const geography = geographies[index]
    if (!geography) continue
    for (const pair of geography.cityZonePairs) {
      const key = cityZoneKey(pair.cityName, pair.zoneNumber)
      if (unionPairs.has(key)) continue
      unionPairs.set(key, pair)
      const zones = zonesByCity.get(pair.cityName)
      if (zones) zones.push(pair.zoneNumber)
      else zonesByCity.set(pair.cityName, [pair.zoneNumber])
    }
  }

  for (const [cityName, zones] of zonesByCity) {
    zonesByCity.set(cityName, sortedUniqueZoneNumbers(zones))
  }

  const unionGeography: NucleusElectionGeography = {
    cities: uniqueSortedCities(zonesByCity.keys()),
    zonesByCity,
    cityZonePairs: [...unionPairs.values()],
  }

  const candidateVotesByCityZone = await loadCandidateVotesByCityZone(payload, user, unionGeography)

  let estimateSum = 0
  let candidateVotesSum = 0
  let comparableCount = 0
  let above = 0
  let below = 0

  for (const index of comparableIndexes) {
    const geography = geographies[index]
    const estimate = nuclei[index]?.confirmedVoteEstimate
    if (!geography || estimate == null) continue

    const candidateVotes = sumCandidateVotesForGeography(geography, candidateVotesByCityZone)
    if (candidateVotes <= 0) continue

    if (estimate >= candidateVotes) above += 1
    else below += 1
    estimateSum += estimate
    candidateVotesSum += candidateVotes
    comparableCount += 1
  }

  return {
    gapTotal: comparableCount > 0 ? estimateSum - candidateVotesSum : null,
    above,
    below,
  }
}
