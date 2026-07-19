// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  aggregateConversionBand,
  aggregateTerritorialClass,
  aggregateVoteTrend,
  comparableTrendCount,
  computeConversionRate,
  computeGapVs2022,
  computeTerritorialClass,
  computeVoteTrend,
  CONVERSION_OPPORTUNITY_MAX,
  CONVERSION_REDUTO_MIN,
  isComparableConversionBand,
  type GapVs2022Baseline,
  TERRITORIAL_ATAQUE_MIN,
  TERRITORIAL_DEFESA_MIN,
  TERRITORIAL_INDECISA_MIN,
} from '@/lib/electionInsights'

const baseline = (candidateVotes: number): GapVs2022Baseline => ({
  candidate: { votes: candidateVotes },
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

describe('computeConversionRate', () => {
  it('classifies oportunidade below 15%', () => {
    const aptos = 10_000
    const estimate = Math.floor(aptos * (CONVERSION_OPPORTUNITY_MAX - 0.001))
    expect(computeConversionRate({ aptos, abstencoes: 0, confirmedVoteEstimate: estimate })).toMatchObject({
      band: 'oportunidade',
      message: `Taxa de conversão: ${Math.round((estimate / aptos) * 100)}% do eleitorado apto`,
    })
  })

  it('classifies consolidado at 15%', () => {
    const aptos = 10_000
    const estimate = aptos * CONVERSION_OPPORTUNITY_MAX
    expect(computeConversionRate({ aptos, abstencoes: 0, confirmedVoteEstimate: estimate }).band).toBe(
      'consolidado',
    )
  })

  it('classifies reduto at 40%', () => {
    const aptos = 10_000
    const estimate = aptos * CONVERSION_REDUTO_MIN
    expect(computeConversionRate({ aptos, abstencoes: 0, confirmedVoteEstimate: estimate }).band).toBe(
      'reduto',
    )
  })

  it('reports semAptos when aptos is zero', () => {
    expect(computeConversionRate({ aptos: 0, abstencoes: 0, confirmedVoteEstimate: 100 })).toMatchObject({
      band: 'semAptos',
      rate: null,
    })
  })

  it('reports semEstimativa when estimate is null', () => {
    expect(computeConversionRate({ aptos: 4700, abstencoes: 680, confirmedVoteEstimate: null })).toMatchObject({
      band: 'semEstimativa',
      rate: null,
    })
  })

  it('includes turnout percent in support line when comparecimento is positive', () => {
    expect(
      computeConversionRate({ aptos: 4700, abstencoes: 680, confirmedVoteEstimate: 850 }).supportLine,
    ).toBe('850 votos / 4.700 eleitores aptos · 21% do comparecimento')
  })
})

describe('aggregateConversionBand', () => {
  it('counts comparable bands only', () => {
    expect(
      aggregateConversionBand(['reduto', 'consolidado', 'oportunidade', 'semEstimativa', 'semAptos']),
    ).toEqual({
      reduto: 1,
      consolidado: 1,
      oportunidade: 1,
    })
  })
})

describe('isComparableConversionBand', () => {
  it('accepts the three comparable bands', () => {
    expect(isComparableConversionBand('reduto')).toBe(true)
    expect(isComparableConversionBand('semEstimativa')).toBe(false)
  })
})

describe('computeTerritorialClass', () => {
  it('classifies defesa at 35% of valid votes', () => {
    const validos = 2490
    expect(
      computeTerritorialClass({
        sollaVotes: Math.ceil(validos * TERRITORIAL_DEFESA_MIN),
        federalValidVotes: validos,
      }),
    ).toMatchObject({
      band: 'defesa',
      title: 'Território de defesa',
    })
  })

  it('classifies indecisa at 20% of valid votes', () => {
    expect(
      computeTerritorialClass({
        sollaVotes: Math.floor(2490 * TERRITORIAL_INDECISA_MIN),
        federalValidVotes: 2490,
      }),
    ).toMatchObject({
      band: 'indecisa',
      title: 'Território indeciso',
    })
  })

  it('classifies ataque at 10% of valid votes', () => {
    expect(
      computeTerritorialClass({
        sollaVotes: Math.floor(2490 * TERRITORIAL_ATAQUE_MIN),
        federalValidVotes: 2490,
      }),
    ).toMatchObject({
      band: 'ataque',
      title: 'Território de ataque',
    })
  })

  it('classifies perdida below 10%', () => {
    expect(
      computeTerritorialClass({
        sollaVotes: Math.floor(2490 * (TERRITORIAL_ATAQUE_MIN - 0.001)),
        federalValidVotes: 2490,
      }),
    ).toMatchObject({
      band: 'perdida',
      title: 'Território perdido',
    })
  })

  it('reports semBaseline when validos is zero', () => {
    expect(computeTerritorialClass({ sollaVotes: 100, federalValidVotes: 0 })).toMatchObject({
      band: 'semBaseline',
      percentValid: null,
    })
  })

  it('reports semBaseline when validos is null', () => {
    expect(computeTerritorialClass({ sollaVotes: 100, federalValidVotes: null })).toMatchObject({
      band: 'semBaseline',
    })
  })
})

describe('aggregateTerritorialClass', () => {
  it('counts comparable territorial bands only', () => {
    expect(
      aggregateTerritorialClass(['defesa', 'ataque', 'indecisa', 'perdida', 'semBaseline']),
    ).toEqual({
      defesa: 1,
      ataque: 1,
      indecisa: 1,
      perdida: 1,
    })
  })

  it('returns all zeros when every band is semBaseline', () => {
    expect(aggregateTerritorialClass(['semBaseline', 'semBaseline'])).toEqual({
      defesa: 0,
      ataque: 0,
      indecisa: 0,
      perdida: 0,
    })
  })
})
