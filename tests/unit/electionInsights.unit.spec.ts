// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { aggregateVoteTrend, comparableTrendCount, computeGapVs2022, computeVoteTrend } from '@/lib/electionInsights'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const baseline = (candidateVotes: number): NucleusElectoralBaselineViewModel => ({
  candidate: { votes: candidateVotes, rank: candidateVotes > 0 ? 1 : null },
  president: null,
  governor: null,
  electorate: { aptos: 0, validos: 0, brancos: 0, nulos: 0, abstencoes: 0 },
  winnerFederal: null,
  series: { y2014: 0, y2018: 0, y2022: candidateVotes },
})

describe('computeGapVs2022', () => {
  it('reports below when the estimate is under the 2022 patamar', () => {
    expect(computeGapVs2022(baseline(850), 500)).toEqual({
      gap: -350,
      ratio: 500 / 850,
      status: 'below',
      message: 'Faltam 350 votos para o patamar de 2022',
    })
  })

  it('reports above with the percent over 2022', () => {
    expect(computeGapVs2022(baseline(850), 952)).toMatchObject({
      gap: 102,
      status: 'above',
      message: 'Já superamos 2022 em 12%',
    })
  })

  it('reports noCandidateVotes when the geography had zero candidate votes in 2022', () => {
    expect(computeGapVs2022(baseline(0), 100)).toEqual({
      gap: null,
      ratio: null,
      status: 'noCandidateVotes',
      message: 'Jorge Solla não recebeu votos aqui em 2022 — território novo a abrir',
    })
  })

  it('reports noEstimate when confirmedVoteEstimate is null', () => {
    expect(computeGapVs2022(baseline(850), null)).toEqual({
      gap: null,
      ratio: null,
      status: 'noEstimate',
      message: 'Sem estimativa confirmada para comparar',
    })
  })

  it('reports noBaseline when geography is missing', () => {
    expect(computeGapVs2022(null, 100)).toEqual({
      gap: null,
      ratio: null,
      status: 'noBaseline',
      message: 'Sem baseline TSE (informe território/município)',
    })
  })
})

describe('computeVoteTrend', () => {
  it('classifies increase when the latest step exceeds 10%', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1200, y2022: 1400 })).toMatchObject({
      status: 'increase',
      ratio: 1400 / 1200,
    })
  })

  it('classifies decline when the latest step drops more than 10%', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1200, y2022: 1000 })).toMatchObject({
      status: 'decline',
      ratio: 1000 / 1200,
    })
  })

  it('classifies stable within the ±10% band on the preferred 2018→2022 pair', () => {
    expect(computeVoteTrend({ y2014: 500, y2018: 1000, y2022: 1050 })).toMatchObject({
      status: 'stable',
      ratio: 1.05,
    })
  })

  it('falls back to 2014→2018 when 2022 is missing', () => {
    expect(computeVoteTrend({ y2014: 1000, y2018: 1500, y2022: 0 })).toMatchObject({
      status: 'increase',
    })
  })

  it('reports noBaseline with fewer than two non-zero years', () => {
    expect(computeVoteTrend({ y2014: 0, y2018: 0, y2022: 500 }).status).toBe('noBaseline')
  })
})

describe('aggregateVoteTrend', () => {
  it('counts trend statuses across nucleus series', () => {
    expect(
      aggregateVoteTrend([
        { y2014: 1000, y2018: 1200, y2022: 1400 },
        { y2014: 1000, y2018: 1200, y2022: 1000 },
        { y2014: 0, y2018: 0, y2022: 500 },
      ]),
    ).toEqual({
      increase: 1,
      decline: 1,
      stable: 0,
      noBaseline: 1,
    })
  })
})

describe('comparableTrendCount', () => {
  it('sums increase, stable, and decline only', () => {
    expect(
      comparableTrendCount({ increase: 2, stable: 1, decline: 3, noBaseline: 4 }),
    ).toBe(6)
  })
})
