import { describe, expect, it } from 'vitest'

import {
  buildCompetitiveRankClassing,
  buildLqClassing,
  buildQuantileClassing,
  fillsForClassing,
  QUANTILE_CLASSES,
  QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT,
} from '@/lib/mapScaleClasses'
import { AT_STANDARD_LQ, TERRITORIAL_CLASS_ANCHORS } from '@/lib/territorialClassAnchors'

const valuesFrom = (numbers: number[]): Record<string, number> =>
  Object.fromEntries(numbers.map((value, index) => [`k${index}`, value]))

describe('buildQuantileClassing', () => {
  it('cuts a large set into five classes ordered weakest to strongest', () => {
    const values = valuesFrom(Array.from({ length: 100 }, (_, index) => index + 1))
    const classing = buildQuantileClassing(values)

    expect(classing.classes).toHaveLength(QUANTILE_CLASSES)
    expect(classing.classIndexByKey.k0).toBe(0)
    expect(classing.classIndexByKey.k99).toBe(QUANTILE_CLASSES - 1)
  })

  it('splits evenly: each quantile holds about a fifth of the features', () => {
    const values = valuesFrom(Array.from({ length: 100 }, (_, index) => index + 1))
    const classing = buildQuantileClassing(values)

    const counts = new Array(QUANTILE_CLASSES).fill(0)
    for (const index of Object.values(classing.classIndexByKey)) counts[index] += 1

    expect(counts).toEqual([20, 20, 20, 20, 20])
  })

  it('degrades to three classes below the minimum feature count', () => {
    const values = valuesFrom(
      Array.from({ length: QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT - 1 }, (_, i) => (i + 1) * 10),
    )
    const classing = buildQuantileClassing(values)

    expect(classing.classes).toHaveLength(3)
  })

  it('collapses classes rather than repeating a break when values tie heavily', () => {
    const classing = buildQuantileClassing(valuesFrom([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 900]))

    // Eleven features share one value: quantiles 1-4 all end at 5, so the
    // legend gets two honest classes instead of five with duplicate bounds.
    expect(classing.classes).toHaveLength(2)
    expect(classing.classes[0].label).toBe('5')
    expect(classing.classes[1].label).toBe('900')
  })

  it('excludes zero and negative values from the classing', () => {
    const classing = buildQuantileClassing({ a: 0, b: -5, c: 10, d: 20 })

    expect(classing.classIndexByKey).not.toHaveProperty('a')
    expect(classing.classIndexByKey).not.toHaveProperty('b')
    expect(Object.keys(classing.classIndexByKey)).toEqual(['c', 'd'])
  })

  it('returns nothing to paint when no feature has a positive value', () => {
    const classing = buildQuantileClassing({ a: 0, b: 0 })

    expect(classing.classes).toEqual([])
    expect(classing.classIndexByKey).toEqual({})
  })

  it('labels each class with its real extremes, never an invented gap', () => {
    const classing = buildQuantileClassing(valuesFrom([1, 2, 3, 40, 50, 60, 700, 800, 900]))

    expect(classing.classes.map((entry) => entry.label)).toEqual(['1–3', '40–60', '700–900'])
  })

  it('labels a single-value class with that value alone', () => {
    const classing = buildQuantileClassing({ a: 42 })

    expect(classing.classes).toHaveLength(1)
    expect(classing.classes[0].label).toBe('42')
  })
})

describe('buildLqClassing', () => {
  const classOf = (lq: number) => buildLqClassing({ a: lq }).classIndexByKey.a

  it('cuts on E10 anchors, so the map and the list agree on "reduto"', () => {
    expect(classOf(TERRITORIAL_CLASS_ANCHORS.weakLq - 0.01)).toBe(0)
    expect(classOf(TERRITORIAL_CLASS_ANCHORS.weakLq)).toBe(1)
    expect(classOf(AT_STANDARD_LQ.min)).toBe(2)
    expect(classOf(AT_STANDARD_LQ.max)).toBe(3)
    expect(classOf(TERRITORIAL_CLASS_ANCHORS.strongLq)).toBe(4)
    expect(classOf(TERRITORIAL_CLASS_ANCHORS.strongLq + 10)).toBe(4)
  })

  it('always offers the five named bands, even when only one is populated', () => {
    const classing = buildLqClassing({ a: 1 })

    expect(classing.classes).toHaveLength(5)
  })

  it('spells the band edges without rounding 0,95 into 1', () => {
    const labels = buildLqClassing({ a: 1 }).classes.map((entry) => entry.label)

    expect(labels).toEqual([
      'menos de 0,5×',
      '0,5×–0,95×',
      'no padrão (≈1×)',
      '1,15×–2×',
      '2× ou mais',
    ])
  })

  it('skips municípios with no measurable standard', () => {
    expect(buildLqClassing({ a: 0 }).classIndexByKey).toEqual({})
  })
})

describe('buildCompetitiveRankClassing', () => {
  const classOf = (rank: number) => buildCompetitiveRankClassing({ a: rank }).classIndexByKey.a

  it('puts the strongest placement in the darkest class', () => {
    expect(classOf(1)).toBe(2)
    expect(classOf(2)).toBe(1)
    expect(classOf(3)).toBe(1)
    expect(classOf(4)).toBe(0)
    expect(classOf(120)).toBe(0)
  })

  it('reads weakest to strongest, like every other legend', () => {
    const labels = buildCompetitiveRankClassing({ a: 1 }).classes.map((entry) => entry.label)

    expect(labels).toEqual(['4º ou pior', '2º–3º', '1º'])
  })

  it('ignores an impossible placement instead of painting it', () => {
    expect(buildCompetitiveRankClassing({ a: 0 }).classIndexByKey).toEqual({})
  })
})

describe('fillsForClassing', () => {
  it('maps every classed key to its class fill', () => {
    const classing = buildQuantileClassing(valuesFrom([1, 2, 3, 40, 50, 60, 700, 800, 900]))
    const fills = fillsForClassing(classing)

    expect(Object.keys(fills)).toHaveLength(9)
    expect(fills.k0).toBe(classing.classes[0].fill)
    expect(fills.k8).toBe(classing.classes[2].fill)
  })

  it('gives each class a distinguishable fill', () => {
    const classing = buildQuantileClassing(
      valuesFrom(Array.from({ length: 100 }, (_, index) => index + 1)),
    )

    expect(new Set(classing.classes.map((entry) => entry.fill)).size).toBe(QUANTILE_CLASSES)
  })
})
