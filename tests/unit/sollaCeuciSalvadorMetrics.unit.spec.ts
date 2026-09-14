import { describe, expect, it } from 'vitest'

import {
  averageRanks,
  buildBairroMetrics,
  buildBairroSummary,
  buildReportSummary,
  buildZoneMetrics,
  classifyZone,
  cosineSimilarity,
  hhi,
  localQuotient,
  overlapCoefficient,
  pearson,
  shareOf,
  spearman,
  topShare,
  ZONE_CLASSES,
} from '../../scripts/lib/sollaCeuciSalvadorMetrics.mjs'

describe('sollaCeuciSalvadorMetrics', () => {
  it('keeps shareOf safe on a missing denominator', () => {
    expect(shareOf(10, 40)).toBe(0.25)
    expect(shareOf(10, 0)).toBe(0)
  })

  it('computes the local quotient against the valid-vote share', () => {
    // 10% of the candidate's vote in a zone holding 5% of the valid votes → LQ 2.
    expect(localQuotient(10, 100, 50, 1000)).toBeCloseTo(2)
    // Zone with no valid votes never divides by zero.
    expect(localQuotient(10, 100, 0, 1000)).toBe(0)
  })

  it('computes Pearson on a perfectly correlated pair', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
    expect(pearson([1], [2])).toBe(0)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0)
  })

  it('averages tied ranks and correlates ranks for Spearman', () => {
    expect(averageRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1)
  })

  it('measures distribution overlap and cosine similarity', () => {
    expect(overlapCoefficient([0.5, 0.5], [0.5, 0.5])).toBeCloseTo(1)
    expect(overlapCoefficient([1, 0], [0, 1])).toBe(0)
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0)
  })

  it('measures concentration with HHI and top shares', () => {
    expect(hhi([0.5, 0.5])).toBeCloseTo(0.5)
    expect(topShare([0.1, 0.4, 0.3, 0.2], 2)).toBeCloseTo(0.7)
  })

  it('classifies the four LQ quadrants', () => {
    expect(classifyZone(1.2, 1.1)).toBe(ZONE_CLASSES.shared)
    expect(classifyZone(1.2, 0.9)).toBe(ZONE_CLASSES.solla)
    expect(classifyZone(0.9, 1.2)).toBe(ZONE_CLASSES.ceuci)
    expect(classifyZone(0.9, 0.9)).toBe(ZONE_CLASSES.open)
  })

  it('builds per-zone metrics and the summary from a two-zone fixture', () => {
    const zones = [
      {
        zoneNumber: 1,
        sollaVotes: 80,
        ceuciVotes: 20,
        federalValid: 800,
        stateValid: 800,
        sollaFederalRank: 1,
        federalCandidates: 10,
        ceuciStateRank: 9,
        stateCandidates: 10,
      },
      {
        zoneNumber: 2,
        sollaVotes: 20,
        ceuciVotes: 80,
        federalValid: 500,
        stateValid: 200,
        sollaFederalRank: 9,
        federalCandidates: 10,
        ceuciStateRank: 1,
        stateCandidates: 10,
      },
    ]
    const salvadorTotals = {
      sollaVotes: 100,
      ceuciVotes: 100,
      federalValid: 1000,
      stateValid: 1000,
    }
    const metrics = buildZoneMetrics({ zones, salvadorTotals })
    // Zone 1: 80% of Solla's vote over 80% of the valid votes → LQ 1; Ceuci 0.2/0.8 → 0.25.
    expect(metrics[0].sollaLq).toBeCloseTo(1)
    expect(metrics[0].ceuciLq).toBeCloseTo(0.25)
    expect(metrics[0].zoneClass).toBe(ZONE_CLASSES.solla)
    expect(metrics[1].zoneClass).toBe(ZONE_CLASSES.ceuci)

    const summary = buildReportSummary({
      metrics,
      candidates: { solla: { stateVotes: 200 }, ceuci: { stateVotes: 400 } },
      salvadorTotals,
    })
    expect(summary.overlapCoefficient).toBeCloseTo(0.4)
    expect(summary.pearson).toBeCloseTo(-1)
    expect(summary.salvadorShareOfSollaState).toBeCloseTo(0.5)
    expect(summary.salvadorShareOfCeuciState).toBeCloseTo(0.25)
    expect(summary.ceuciAhead.map((zone: { zoneNumber: number }) => zone.zoneNumber)).toEqual([2])
  })

  it('builds per-bairro metrics with the bairro as the denominator', () => {
    const bairros = [
      { name: 'A', sollaVotes: 80, ceuciVotes: 20, federalNominal: 800, stateNominal: 800 },
      { name: 'B', sollaVotes: 20, ceuciVotes: 20, federalNominal: 100, stateNominal: 100 },
      { name: 'C', sollaVotes: 0, ceuciVotes: 60, federalNominal: 100, stateNominal: 100 },
    ]
    const totals = {
      sollaVotes: 100,
      ceuciVotes: 100,
      federalNominal: 1000,
      stateNominal: 1000,
    }
    const metrics = buildBairroMetrics({ bairros, totals })
    expect(metrics[0].sollaLq).toBeCloseTo(1)
    expect(metrics[0].ceuciLq).toBeCloseTo(0.25)
    expect(metrics[0].bairroClass).toBe(ZONE_CLASSES.solla)
    expect(metrics[1].bairroClass).toBe(ZONE_CLASSES.shared)
    expect(metrics[2].bairroClass).toBe(ZONE_CLASSES.ceuci)
    expect(metrics[2].ceuciLq).toBeCloseTo(6)

    const summary = buildBairroSummary({ metrics })
    expect(summary.overlapCoefficient).toBeCloseTo(0.4)
    expect(summary.strongestCombined.map((bairro) => bairro.name)).toEqual(['A', 'C', 'B'])
    expect(summary.ceuciAhead.map((bairro) => bairro.name)).toEqual(['C'])
    expect(summary.sollaAhead.map((bairro) => bairro.name)).toEqual(['A'])
    expect(summary.topCeuciLq).toEqual([])
  })
})
