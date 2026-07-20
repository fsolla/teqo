import type { Payload, Where } from 'payload'

import { citiesForTerritory, isBahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2014,
  ELECTION_YEAR_2018,
  ELECTION_YEAR_2022,
  HISTORICAL_PRIOR_SERIES_YEARS,
  HISTORICAL_SERIES_YEARS,
  type ElectionOffice,
  type ElectionTurn,
} from '@/lib/electionResults'
import {
  aggregateConversionBand,
  aggregateTerritorialClass,
  aggregateTicketFlipOverview,
  aggregateTicketLeverageOverview,
  aggregateVoteTrend,
  aggregateMobilizationOverview,
  computeConversionRate,
  computeGapVs2022,
  computeTerritorialClass,
  computeTicketFlipOpportunity,
  computeTicketLeverage,
  isComparableConversionBand,
  isComparableTerritorialClass,
  type MobilizationOverviewAggregate,
  type MobilizationOpportunityInput,
  type ConversionBandDistribution,
  type ConversionRateBand,
  type TerritorialClassificationBand,
  type TerritorialClassificationDistribution,
  type TicketFlipOpportunityResult,
  type TicketFlipOverviewAggregate,
  type TicketLeverageOverviewAggregate,
  type VoteTrendSeries,
  type VoteTrendStatus,
} from '@/lib/electionInsights'
import { type ElectionDataReader } from '@/utilities/campaignAccess'
import { normalizeTerritoryTextArray } from '@/utilities/campaignTerritoryValidation'
import {
  loadFederalCandidateTotalsAggregated,
  type FederalCandidateTotal,
} from '@/utilities/federalCandidateTotalsAggregate'
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
  winnerCandidateName?: string | null
  winnerParty?: string | null
  winnerVotes?: number | null
}

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

  return { zonesByCity, cityZonePairs }
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

/** In-memory reference aggregate for unit tests; production uses drizzle GROUP BY. */
export const aggregateFederalCandidateTotals = (
  votes: readonly ElectionVoteAggregateRow[],
  geography: NucleusElectionGeography,
): FederalCandidateTotal[] => {
  const byCandidate = new Map<number, FederalCandidateTotal>()

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

const aggregateFederalVotesByParty = (
  federalTotals: ReadonlyArray<{ party: string; votes: number }>,
): Record<string, number> => {
  const byParty: Record<string, number> = {}
  for (const { party, votes } of federalTotals) {
    if (!party || votes <= 0) continue
    byParty[party] = (byParty[party] ?? 0) + votes
  }
  return byParty
}

const federalRaceSnapshot = (
  federalTotals: ReadonlyArray<{ name: string; party: string; votes: number }>,
) => {
  const winner = federalTotals[0] ?? null
  return {
    winnerFederal: winner
      ? { name: winner.name, votes: winner.votes, party: winner.party }
      : null,
    federalVotesByParty: aggregateFederalVotesByParty(federalTotals),
  }
}

const majoritarianTicketVoteTotals = (
  votes: readonly ElectionVoteAggregateRow[],
  geography: NucleusElectionGeography,
): { presidentVotes: number | null; governorVotes: number | null } => ({
  presidentVotes:
    decisiveTicketVotes(
      votes,
      geography,
      'presidente',
      BASELINE_TICKET_2022.president.candidateNumber,
    )?.votes ?? null,
  governorVotes:
    decisiveTicketVotes(
      votes,
      geography,
      'governador',
      BASELINE_TICKET_2022.governor.candidateNumber,
    )?.votes ?? null,
})

export type MajoritarianWinnerAggregate =
  | { name: string; party: string; votes: number }
  | 'ambiguous'
  | null

export const aggregateMajoritarianWinner = (
  tallies: readonly ElectionTallyAggregateRow[],
  geography: NucleusElectionGeography,
  office: 'presidente' | 'governador',
): MajoritarianWinnerAggregate => {
  const rows = tallies.filter(
    (row) =>
      row.office === office &&
      matchesGeography(row, geography) &&
      row.winnerCandidateName &&
      row.winnerParty &&
      row.winnerVotes != null &&
      row.winnerVotes > 0,
  )

  if (rows.length === 0) return null

  const hasTurn2 = rows.some((row) => row.turn === '2')
  const decisiveTurn: ElectionTurn = hasTurn2 ? '2' : '1'
  const decisiveRows = rows.filter((row) => row.turn === decisiveTurn)

  const byCandidate = new Map<string, { name: string; party: string; votes: number }>()
  for (const row of decisiveRows) {
    const name = row.winnerCandidateName!
    const party = row.winnerParty!
    const key = `${name}::${party}`
    const votes = row.winnerVotes ?? 0
    const existing = byCandidate.get(key)
    if (existing) {
      existing.votes += votes
      continue
    }
    byCandidate.set(key, { name, party, votes })
  }

  const sorted = [...byCandidate.values()].sort((left, right) => {
    if (right.votes !== left.votes) return right.votes - left.votes
    return left.name.localeCompare(right.name, 'pt-BR')
  })

  if (sorted.length === 0) return null
  if (sorted.length > 1 && sorted[0]!.votes === sorted[1]!.votes) return 'ambiguous'
  return sorted[0]!
}

const majoritarianWinnerOrNull = (
  aggregate: MajoritarianWinnerAggregate,
): { name: string; party: string; votes: number } | null =>
  aggregate === 'ambiguous' || aggregate === null ? null : aggregate

const resolveMajoritarianWinners = (
  majoritarianTallies: readonly ElectionTallyAggregateRow[],
  geography: NucleusElectionGeography,
): { president: MajoritarianWinnerAggregate; governor: MajoritarianWinnerAggregate } => ({
  president: aggregateMajoritarianWinner(majoritarianTallies, geography, 'presidente'),
  governor: aggregateMajoritarianWinner(majoritarianTallies, geography, 'governador'),
})

const AMBIGUOUS_FLIP_RESULT: TicketFlipOpportunityResult = {
  status: 'ambiguous',
  trigger: null,
  majoritarianAlignment: null,
  rightShare: null,
  rightVotes: 0,
  totalFederalVotes: 0,
  message: 'Empate nos vencedores majoritários nesta geografia',
  supportLine: null,
}

const computeTicketFlipForGeography = (
  federalTotals: readonly FederalCandidateTotal[],
  majoritarianTallies: readonly ElectionTallyAggregateRow[],
  geography: NucleusElectionGeography,
): TicketFlipOpportunityResult => {
  const { president: presidentAgg, governor: governorAgg } = resolveMajoritarianWinners(
    majoritarianTallies,
    geography,
  )

  if (presidentAgg === 'ambiguous' || governorAgg === 'ambiguous') {
    return AMBIGUOUS_FLIP_RESULT
  }

  const federalRace = federalRaceSnapshot(federalTotals)

  return computeTicketFlipOpportunity({
    winnerPresident: presidentAgg,
    winnerGovernor: governorAgg,
    winnerFederal: federalRace.winnerFederal,
    federalVotesByParty: federalRace.federalVotesByParty,
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

const sumFederalTallyForGeography = (
  talliesByCityZone: ReadonlyMap<string, ElectionTallyAggregateRow>,
  geography: NucleusElectionGeography,
): Pick<
  NucleusElectoralBaselineViewModel['electorate'],
  'aptos' | 'abstencoes' | 'validos' | 'brancos' | 'nulos'
> => {
  let aptos = 0
  let abstencoes = 0
  let validos = 0
  let brancos = 0
  let nulos = 0

  for (const { cityName, zoneNumber } of geography.cityZonePairs) {
    const row = talliesByCityZone.get(cityZoneKey(cityName, zoneNumber))
    if (!row) continue
    aptos += row.aptos
    abstencoes += row.abstencoes
    validos += row.votosValidos
    brancos += row.votosBranco
    nulos += row.votosNulo
  }

  return { aptos, abstencoes, validos, brancos, nulos }
}

export const aggregateNucleusElectoralBaseline = (
  geography: NucleusElectionGeography,
  federalTotals: readonly FederalCandidateTotal[],
  ticketVotes: readonly ElectionVoteAggregateRow[],
  tallies: readonly ElectionTallyAggregateRow[],
  historicalVotes: Pick<VoteTrendSeries, 'y2014' | 'y2018'>,
  majoritarianTallies: readonly ElectionTallyAggregateRow[] = [],
): NucleusElectoralBaselineViewModel => {
  // `federalTotals` must be sorted by votes desc (SQL aggregate or aggregateFederalCandidateTotals).
  const candidateIndex = federalTotals.findIndex(
    (candidate) => candidate.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber,
  )
  const candidateRow = federalTotals[candidateIndex]
  const candidateVotes = candidateRow?.votes ?? 0
  const federalRace = federalRaceSnapshot(federalTotals)
  const { president: presidentWinner, governor: governorWinner } = resolveMajoritarianWinners(
    majoritarianTallies,
    geography,
  )
  const ticketFlip =
    presidentWinner === 'ambiguous' || governorWinner === 'ambiguous'
      ? AMBIGUOUS_FLIP_RESULT
      : computeTicketFlipOpportunity({
          winnerPresident: presidentWinner,
          winnerGovernor: governorWinner,
          winnerFederal: federalRace.winnerFederal,
          federalVotesByParty: federalRace.federalVotesByParty,
        })

  return {
    candidate: {
      votes: candidateVotes,
      rank: candidateIndex >= 0 ? candidateIndex + 1 : null,
    },
    president: decisiveTicketVotes(
      ticketVotes,
      geography,
      'presidente',
      BASELINE_TICKET_2022.president.candidateNumber,
    ),
    governor: decisiveTicketVotes(
      ticketVotes,
      geography,
      'governador',
      BASELINE_TICKET_2022.governor.candidateNumber,
    ),
    electorate: aggregateElectorate(tallies, geography),
    winnerFederal: federalRace.winnerFederal,
    winnerPresident: majoritarianWinnerOrNull(presidentWinner),
    winnerGovernor: majoritarianWinnerOrNull(governorWinner),
    federalVotesByParty: federalRace.federalVotesByParty,
    ticketFlip,
    series: {
      y2014: historicalVotes.y2014,
      y2018: historicalVotes.y2018,
      y2022: candidateVotes,
    },
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

/** President/governor ticket votes for the detail baseline card (lean Local API path). */
const ticketOfficeVoteWhere = (geography: NucleusElectionGeography): Where => ({
  and: [
    ...ba2022Scope(),
    { voteType: { equals: 'nominal' } },
    geographyWhere(geography),
    {
      or: [
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

const loadTicketOfficeVotes = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionDataReader,
  geography: NucleusElectionGeography,
): Promise<ElectionVoteAggregateRow[]> => {
  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: ticketOfficeVoteWhere(geography),
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
  user: ElectionDataReader,
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

const loadMajoritarianElectionTallies = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionDataReader,
  geography: NucleusElectionGeography,
): Promise<ElectionTallyAggregateRow[]> => {
  const result = await payload.find({
    collection: 'electionTally',
    where: {
      and: [
        ...ba2022Scope(),
        geographyWhere(geography),
        {
          or: [
            {
              and: [{ office: { equals: 'presidente' } }, { turn: { in: ['1', '2'] } }],
            },
            {
              and: [{ office: { equals: 'governador' } }, { turn: { in: ['1', '2'] } }],
            },
          ],
        },
      ],
    },
    depth: 0,
    pagination: false,
    select: {
      office: true,
      turn: true,
      cityName: true,
      zoneNumber: true,
      winnerCandidateName: true,
      winnerParty: true,
      winnerVotes: true,
    },
    user,
    overrideAccess: false,
  })

  return result.docs.map((doc) => ({
    office: doc.office,
    turn: doc.turn,
    cityName: doc.cityName,
    zoneNumber: doc.zoneNumber,
    aptos: 0,
    votosValidos: 0,
    votosBranco: 0,
    votosNulo: 0,
    abstencoes: 0,
    winnerCandidateName: doc.winnerCandidateName,
    winnerParty: doc.winnerParty,
    winnerVotes: doc.winnerVotes,
  }))
}

const buildUnionGeography = (
  geographies: ReadonlyArray<NucleusElectionGeography | null>,
  indexes: readonly number[],
): NucleusElectionGeography | null => {
  const unionPairs = new Map<string, { cityName: string; zoneNumber: number }>()
  const zonesByCity = new Map<string, number[]>()

  for (const index of indexes) {
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

  if (unionPairs.size === 0) return null

  for (const [cityName, zones] of zonesByCity) {
    zonesByCity.set(cityName, sortedUniqueZoneNumbers(zones))
  }

  return {
    zonesByCity,
    cityZonePairs: [...unionPairs.values()],
  }
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

/** Candidate-only votes indexed by year then city×zone (E2 lean loader). */
const loadCandidateSeriesByGeography = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionDataReader,
  geography: NucleusElectionGeography,
  years: readonly number[] = [...HISTORICAL_SERIES_YEARS],
): Promise<Map<number, Map<string, number>>> => {
  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { in: [...years] } },
        { state: { equals: 'BA' } },
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
      year: true,
      cityName: true,
      zoneNumber: true,
      votes: true,
    },
    user,
    overrideAccess: false,
  })

  const byYear = new Map<number, Map<string, number>>()
  for (const doc of result.docs) {
    const year = Number(doc.year)
    const key = cityZoneKey(doc.cityName, doc.zoneNumber)
    const yearMap = byYear.get(year) ?? new Map<string, number>()
    yearMap.set(key, (yearMap.get(key) ?? 0) + doc.votes)
    byYear.set(year, yearMap)
  }
  return byYear
}

const sumCandidateSeriesForGeography = (
  geography: NucleusElectionGeography,
  seriesByYear: ReadonlyMap<number, ReadonlyMap<string, number>>,
  years: readonly number[] = [...HISTORICAL_SERIES_YEARS],
): VoteTrendSeries => {
  const totalsByYear = new Map<number, number>()
  for (const year of years) {
    const cityZoneVotes = seriesByYear.get(year)
    totalsByYear.set(
      year,
      cityZoneVotes ? sumCandidateVotesForGeography(geography, cityZoneVotes) : 0,
    )
  }
  return {
    y2014: totalsByYear.get(ELECTION_YEAR_2014) ?? 0,
    y2018: totalsByYear.get(ELECTION_YEAR_2018) ?? 0,
    y2022: totalsByYear.get(ELECTION_YEAR_2022) ?? 0,
  }
}

export const getNucleusElectoralBaseline = async (
  payload: Pick<Payload, 'find' | 'db'>,
  user: ElectionDataReader,
  nucleus: NucleusElectionGeographyInput,
): Promise<NucleusElectoralBaselineViewModel | null> => {
  const geography = resolveNucleusElectionGeography(nucleus)
  if (!geography) return null

  const [federalTotals, ticketVotes, tallies, majoritarianTallies, seriesByYear] = await Promise.all([
    loadFederalCandidateTotalsAggregated(payload, user, geography),
    loadTicketOfficeVotes(payload, user, geography),
    loadElectionTallies(payload, user, geography),
    loadMajoritarianElectionTallies(payload, user, geography),
    loadCandidateSeriesByGeography(payload, user, geography, HISTORICAL_PRIOR_SERIES_YEARS),
  ])

  const historicalVotes = sumCandidateSeriesForGeography(
    geography,
    seriesByYear,
    HISTORICAL_PRIOR_SERIES_YEARS,
  )
  return aggregateNucleusElectoralBaseline(
    geography,
    federalTotals,
    ticketVotes,
    tallies,
    historicalVotes,
    majoritarianTallies,
  )
}

export type NucleusBaseline2022OverviewInput = NucleusElectionGeographyInput & {
  confirmedVoteEstimate: number | null
}

export type NucleusBaseline2022OverviewAggregate = {
  gapTotal: number | null
  above: number
  below: number
}

export type NucleusTrendOverviewAggregate = Record<VoteTrendStatus, number>

export type NucleusConversionOverviewAggregate = {
  weightedRate: number
  distribution: ConversionBandDistribution
}

export type NucleusClassificationOverviewAggregate = {
  distribution: TerritorialClassificationDistribution
}

export type NucleusListElectionOverview = {
  baseline2022: NucleusBaseline2022OverviewAggregate | null
  trend: NucleusTrendOverviewAggregate | null
  conversion: NucleusConversionOverviewAggregate | null
  mobilization: MobilizationOverviewAggregate | null
  leverage: TicketLeverageOverviewAggregate | null
  flipOpportunity: TicketFlipOverviewAggregate | null
  classification: NucleusClassificationOverviewAggregate | null
}

/**
 * Gap vs 2022 and vote-trend distribution over a filtered nucleus set (one union query).
 */
export const loadNucleusListElectionOverview = async (
  payload: Pick<Payload, 'find' | 'db'>,
  user: ElectionDataReader,
  nuclei: readonly NucleusBaseline2022OverviewInput[],
): Promise<NucleusListElectionOverview> => {
  const geographies = nuclei.map((nucleus) => resolveNucleusElectionGeography(nucleus))
  const withGeographyIndexes = geographies.flatMap((geography, index) =>
    geography ? [index] : [],
  )

  if (withGeographyIndexes.length === 0) {
    return {
      baseline2022: null,
      trend: null,
      conversion: null,
      mobilization: null,
      leverage: null,
      flipOpportunity: null,
      classification: null,
    }
  }

  const comparableIndexes: number[] = []
  for (const index of withGeographyIndexes) {
    if (nuclei[index]?.confirmedVoteEstimate == null) continue
    comparableIndexes.push(index)
  }

  const unionGeography = buildUnionGeography(geographies, withGeographyIndexes)
  if (!unionGeography) {
    return {
      baseline2022: null,
      trend: null,
      conversion: null,
      mobilization: null,
      leverage: null,
      flipOpportunity: null,
      classification: null,
    }
  }

  const [seriesByYear, ticketVotes, majoritarianTallies, classificationTallies] = await Promise.all([
    loadCandidateSeriesByGeography(payload, user, unionGeography),
    loadTicketOfficeVotes(payload, user, unionGeography),
    loadMajoritarianElectionTallies(payload, user, unionGeography),
    loadElectionTallies(payload, user, unionGeography),
  ])
  const votes2022 = seriesByYear.get(ELECTION_YEAR_2022) ?? new Map<string, number>()
  const classificationTalliesByCityZone = new Map(
    classificationTallies.map((row) => [cityZoneKey(row.cityName, row.zoneNumber), row]),
  )

  const trend = aggregateVoteTrend(
    withGeographyIndexes.flatMap((index) => {
      const geography = geographies[index]
      return geography ? [sumCandidateSeriesForGeography(geography, seriesByYear)] : []
    }),
  )

  const classificationBands: TerritorialClassificationBand[] = []
  const federalTallyByIndex = new Map<
    number,
    ReturnType<typeof sumFederalTallyForGeography>
  >()
  const mobilizationInput: MobilizationOpportunityInput = {
    aptos: 0,
    abstencoes: 0,
    brancos: 0,
    nulos: 0,
  }

  for (const index of withGeographyIndexes) {
    const geography = geographies[index]!
    const tallies = sumFederalTallyForGeography(classificationTalliesByCityZone, geography)
    federalTallyByIndex.set(index, tallies)
    mobilizationInput.aptos = (mobilizationInput.aptos ?? 0) + tallies.aptos
    mobilizationInput.abstencoes = (mobilizationInput.abstencoes ?? 0) + tallies.abstencoes
    mobilizationInput.brancos = (mobilizationInput.brancos ?? 0) + tallies.brancos
    mobilizationInput.nulos = (mobilizationInput.nulos ?? 0) + tallies.nulos

    const territorial = computeTerritorialClass({
      sollaVotes: sumCandidateVotesForGeography(geography, votes2022),
      federalValidVotes: tallies.validos,
    })
    if (isComparableTerritorialClass(territorial.band)) {
      classificationBands.push(territorial.band)
    }
  }

  const classification: NucleusClassificationOverviewAggregate | null =
    classificationBands.length > 0
      ? { distribution: aggregateTerritorialClass(classificationBands) }
      : null

  const mobilization = aggregateMobilizationOverview(mobilizationInput)

  const flipResults = await Promise.all(
    withGeographyIndexes.map(async (index) => {
      const geography = geographies[index]!
      const federalTotals = await loadFederalCandidateTotalsAggregated(payload, user, geography)
      return computeTicketFlipForGeography(federalTotals, majoritarianTallies, geography)
    }),
  )
  const flipOpportunity = aggregateTicketFlipOverview(flipResults)

  if (comparableIndexes.length === 0) {
    return {
      baseline2022: { gapTotal: null, above: 0, below: 0 },
      trend,
      conversion: null,
      mobilization,
      leverage: null,
      flipOpportunity,
      classification,
    }
  }

  let estimateSum = 0
  let candidateVotesSum = 0
  let comparableCount = 0
  let above = 0
  let below = 0
  let conversionEstimateSum = 0
  let conversionAptosSum = 0
  const conversionBands: ConversionRateBand[] = []
  const leverageRows: Array<{ estimate: number; ticketVotes: number }> = []

  for (const index of comparableIndexes) {
    const geography = geographies[index]
    const estimate = nuclei[index]?.confirmedVoteEstimate
    if (!geography || estimate == null) continue

    const candidateVotes = sumCandidateVotesForGeography(geography, votes2022)
    if (candidateVotes > 0) {
      const gap = computeGapVs2022({ candidate: { votes: candidateVotes } }, estimate)
      if (gap.status === 'above') above += 1
      else if (gap.status === 'below') below += 1
      estimateSum += estimate
      candidateVotesSum += candidateVotes
      comparableCount += 1
    }

    const tallies = federalTallyByIndex.get(index)
    if (!tallies) continue

    const { aptos, abstencoes } = tallies
    const conversion = computeConversionRate({
      aptos,
      abstencoes,
      confirmedVoteEstimate: estimate,
    })
    if (isComparableConversionBand(conversion.band)) {
      conversionEstimateSum += estimate
      conversionAptosSum += aptos
      conversionBands.push(conversion.band)
    }

    const { presidentVotes, governorVotes } = majoritarianTicketVoteTotals(ticketVotes, geography)
    const leverage = computeTicketLeverage({
      confirmedVoteEstimate: estimate,
      presidentVotes,
      governorVotes,
    })
    if (leverage.status === 'comparable' && leverage.ticketVotes !== null) {
      leverageRows.push({ estimate, ticketVotes: leverage.ticketVotes })
    }
  }

  const conversion: NucleusConversionOverviewAggregate | null =
    conversionAptosSum > 0
      ? {
          weightedRate: Math.round((conversionEstimateSum / conversionAptosSum) * 100),
          distribution: aggregateConversionBand(conversionBands),
        }
      : null

  return {
    baseline2022: {
      gapTotal: comparableCount > 0 ? estimateSum - candidateVotesSum : null,
      above,
      below,
    },
    trend,
    conversion,
    mobilization,
    leverage: aggregateTicketLeverageOverview(leverageRows),
    flipOpportunity,
    classification,
  }
}

/** Solla 2022 federal T1 votes indexed by canonical city name (choropleth B3). */
export const loadBaseline2022VotesByCityNames = async (
  payload: Pick<Payload, 'find'>,
  user: ElectionDataReader,
  cityNames: readonly string[],
): Promise<Map<string, number>> => {
  const geography = resolveNucleusElectionGeography({
    cities: [...cityNames],
    regions: [],
    tseZones: [],
  })
  if (!geography) return new Map()

  const seriesByYear = await loadCandidateSeriesByGeography(payload, user, geography, [
    ELECTION_YEAR_2022,
  ])
  const votes2022 = seriesByYear.get(ELECTION_YEAR_2022) ?? new Map<string, number>()
  const byCity = new Map<string, number>()

  for (const city of geography.zonesByCity.keys()) {
    const zones = geography.zonesByCity.get(city) ?? []
    const total = zones.reduce(
      (sum, zoneNumber) => sum + (votes2022.get(cityZoneKey(city, zoneNumber)) ?? 0),
      0,
    )
    if (total > 0) byCity.set(city, total)
  }

  return byCity
}
