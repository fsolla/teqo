// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { citiesForTerritory } from '@/lib/bahiaTerritories'
import { tseZonesForCity } from '@/lib/bahiaTseZones'
import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import { computeConversionRate, computeVoteTrend } from '@/lib/electionInsights'
import {
  aggregateFederalCandidateTotals,
  aggregateNucleusElectoralBaseline,
  resolveNucleusElectionGeography,
  type ElectionTallyAggregateRow,
  type ElectionVoteAggregateRow,
} from '@/utilities/nucleusElectoralBaseline'

const ticketOfficeVotes = (votes: readonly ElectionVoteAggregateRow[]) =>
  votes.filter((row) => row.office === 'presidente' || row.office === 'governador')

describe('resolveNucleusElectionGeography', () => {
  it('intersects nucleus tseZones with official city zones', () => {
    const salvadorZones = tseZonesForCity('Salvador')
    expect(salvadorZones.length).toBeGreaterThan(1)
    const firstZone = salvadorZones[0]!
    const secondZone = salvadorZones[1]!

    const geography = resolveNucleusElectionGeography({
      cities: ['Salvador'],
      regions: [],
      tseZones: [firstZone, 999],
    })

    expect(geography).not.toBeNull()
    expect([...geography!.zonesByCity.keys()]).toEqual(['Salvador'])
    expect(geography?.zonesByCity.get('Salvador')).toEqual([firstZone])
    expect(geography?.cityZonePairs).toEqual([{ cityName: 'Salvador', zoneNumber: firstZone }])
    expect(geography?.zonesByCity.get('Salvador')).not.toContain(secondZone)
  })

  it('falls back to all city zones when typed tseZones lie outside the city', () => {
    const salvadorZones = [...tseZonesForCity('Salvador')]
    const geography = resolveNucleusElectionGeography({
      cities: ['Salvador'],
      regions: [],
      tseZones: [998, 999],
    })

    expect(geography?.zonesByCity.get('Salvador')).toEqual(salvadorZones)
  })

  it('expands territory regions when cities are empty', () => {
    const cities = citiesForTerritory('Velho Chico')
    const geography = resolveNucleusElectionGeography({
      cities: [],
      regions: ['Velho Chico'],
      tseZones: [],
    })

    expect(geography).not.toBeNull()
    expect([...geography!.zonesByCity.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(
      [...cities].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )
    expect(geography?.zonesByCity.get('Bom Jesus da Lapa')).toEqual([
      ...tseZonesForCity('Bom Jesus da Lapa'),
    ])
  })

  it('returns null without cities or regions', () => {
    expect(
      resolveNucleusElectionGeography({
        cities: [],
        regions: [],
        tseZones: [1],
      }),
    ).toBeNull()
  })
})

describe('aggregateNucleusElectoralBaseline', () => {
  const geography = resolveNucleusElectionGeography({
    cities: ['Salvador'],
    regions: [],
    tseZones: [1, 2],
  })!

  const votes: ElectionVoteAggregateRow[] = [
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 1,
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
      candidateName: 'JORGE SOLLA',
      party: 'PT',
      votes: 1200,
    },
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 2,
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
      candidateName: 'JORGE SOLLA',
      party: 'PT',
      votes: 900,
    },
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 1,
      candidateNumber: 2222,
      candidateName: 'RIVAL FEDERAL',
      party: 'PL',
      votes: 800,
    },
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 2,
      candidateNumber: 2222,
      candidateName: 'RIVAL FEDERAL',
      party: 'PL',
      votes: 1100,
    },
    {
      office: 'presidente',
      turn: '2',
      cityName: 'Salvador',
      zoneNumber: 1,
      candidateNumber: BASELINE_TICKET_2022.president.candidateNumber,
      candidateName: 'LULA',
      party: 'PT',
      votes: 8000,
    },
    {
      office: 'governador',
      turn: '2',
      cityName: 'Salvador',
      zoneNumber: 1,
      candidateNumber: BASELINE_TICKET_2022.governor.candidateNumber,
      candidateName: 'JERÔNIMO',
      party: 'PT',
      votes: 6000,
    },
    // Outside selected zones — must be ignored
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Feira de Santana',
      zoneNumber: 10,
      candidateNumber: BASELINE_TICKET_2022.candidate.candidateNumber,
      candidateName: 'JORGE SOLLA',
      party: 'PT',
      votes: 500,
    },
  ]

  const tallies: ElectionTallyAggregateRow[] = [
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 1,
      aptos: 10000,
      votosValidos: 7500,
      votosBranco: 300,
      votosNulo: 200,
      abstencoes: 2000,
    },
    {
      office: 'deputado_federal',
      turn: '1',
      cityName: 'Salvador',
      zoneNumber: 2,
      aptos: 9000,
      votosValidos: 6800,
      votosBranco: 250,
      votosNulo: 150,
      abstencoes: 1800,
    },
  ]

  it('sums the candidate, ticket leaders, electorate, winner, rank, and series for the geography', () => {
    const federalTotals = aggregateFederalCandidateTotals(votes, geography)
    const baseline = aggregateNucleusElectoralBaseline(
      geography,
      federalTotals,
      ticketOfficeVotes(votes),
      tallies,
      {
      y2014: 1000,
      y2018: 1500,
      },
    )

    expect(baseline.candidate).toEqual({ votes: 2100, rank: 1 })
    expect(baseline.president).toEqual({ votes: 8000, turn: 2 })
    expect(baseline.governor).toEqual({ votes: 6000, turn: 2 })
    expect(baseline.electorate).toEqual({
      aptos: 19000,
      validos: 14300,
      brancos: 550,
      nulos: 350,
      abstencoes: 3800,
    })
    // Candidate 2100 vs Rival 1900 → candidate wins and ranks 1
    expect(baseline.winnerFederal).toEqual({
      name: 'JORGE SOLLA',
      votes: 2100,
      party: 'PT',
    })
    expect(baseline.series).toEqual({ y2014: 1000, y2018: 1500, y2022: 2100 })
    expect(computeVoteTrend(baseline.series).status).toBe('increase')
  })

  it('ranks the candidate below the local federal winner when applicable', () => {
    const zone1Only = resolveNucleusElectionGeography({
      cities: ['Salvador'],
      regions: [],
      tseZones: [2],
    })!
    const baseline = aggregateNucleusElectoralBaseline(
      zone1Only,
      aggregateFederalCandidateTotals(votes, zone1Only),
      ticketOfficeVotes(votes),
      tallies,
      {
      y2014: 0,
      y2018: 0,
      },
    )

    expect(baseline.candidate).toEqual({ votes: 900, rank: 2 })
    expect(baseline.winnerFederal).toEqual({
      name: 'RIVAL FEDERAL',
      votes: 1100,
      party: 'PL',
    })
  })

  it('supports conversion rate from electorate aptos and confirmed estimate', () => {
    const baseline = aggregateNucleusElectoralBaseline(
      geography,
      aggregateFederalCandidateTotals(votes, geography),
      ticketOfficeVotes(votes),
      tallies,
      {
      y2014: 0,
      y2018: 0,
      },
    )

    expect(
      computeConversionRate({
        aptos: baseline.electorate.aptos,
        abstencoes: baseline.electorate.abstencoes,
        confirmedVoteEstimate: 850,
      }),
    ).toMatchObject({
      band: 'oportunidade',
      message: 'Taxa de conversão: 4% do eleitorado apto',
      supportLine: '850 votos / 19.000 eleitores aptos · 6% do comparecimento',
    })
  })
})
