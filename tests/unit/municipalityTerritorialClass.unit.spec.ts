import { describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  classifyMunicipalityTerritory,
  computeMunicipalityTerritorialClass,
  TERRITORIAL_CLASS_ANCHORS,
  TERRITORIAL_CLASSES,
  territorialClassSortWeight,
  type MunicipalityTerritorialClass,
  type TerritorialClassInput,
} from '@/utilities/municipalityTerritorialClass'

/**
 * Statewide reference: 100.000 own votes over 5.000.000 valid votes = a 2%
 * statewide share, so a município with a 4% local share has LQ 2 (reduto) and
 * one with 0,5% has LQ 0,25 (weak half).
 */
const input = (overrides: Partial<TerritorialClassInput> = {}): TerritorialClassInput => ({
  ownVotes: 200,
  validVotes: 10_000,
  stateOwnVotes: 100_000,
  stateValidVotes: 5_000_000,
  fieldHeadroom: 1_000,
  medianFieldHeadroom: 2_000,
  captureRate: 0.1,
  inCoreBlock: false,
  ...overrides,
})

describe('classifyMunicipalityTerritory', () => {
  it('classifies as reduto when the local share is at least strongLq × his own standard', () => {
    // 4% local vs 2% statewide = LQ 2
    const result = classifyMunicipalityTerritory(input({ ownVotes: 400, validVotes: 10_000 }))
    expect(result.class).toBe('reduto')
    expect(result.lq).toBe(TERRITORIAL_CLASS_ANCHORS.strongLq)
    expect(result.factors.slice(0, 2).map((factor) => factor.id)).toEqual(['dominance', 'ownShare'])
  })

  it('keeps a tiny reduto as reduto, with ownShare telling it apart from one that carries the account', () => {
    const symbolic = classifyMunicipalityTerritory(input({ ownVotes: 60, validVotes: 1_000 }))
    expect(symbolic.class).toBe('reduto')
    // 60 / 100.000 = 0,06% of his statewide vote — the "reduto simbólico" of P10.
    expect(symbolic.ownShare).toBeCloseTo(0.0006, 6)
  })

  it('classifies as manutenção inside the standard band', () => {
    // 2% local = LQ 1
    expect(classifyMunicipalityTerritory(input({ ownVotes: 200 })).class).toBe('manutencao')
    // Just under the strong cut stays manutenção (boundary is inclusive on reduto)
    expect(classifyMunicipalityTerritory(input({ ownVotes: 399 })).class).toBe('manutencao')
    // Exactly at the weak cut is still manutenção (boundary is exclusive on marginal)
    expect(classifyMunicipalityTerritory(input({ ownVotes: 100 })).lq).toBe(
      TERRITORIAL_CLASS_ANCHORS.weakLq,
    )
    expect(classifyMunicipalityTerritory(input({ ownVotes: 100 })).class).toBe('manutencao')
  })

  it('classifies as expansão when he is weak but the field still has votes to win', () => {
    const result = classifyMunicipalityTerritory(
      input({ ownVotes: 50, fieldHeadroom: 9_000, medianFieldHeadroom: 2_000 }),
    )
    expect(result.class).toBe('expansao')
    expect(result.factors[0]).toEqual({ id: 'field', value: 9_000 })
  })

  it('classifies as marginal when he is weak and the field is small', () => {
    expect(
      classifyMunicipalityTerritory(
        input({ ownVotes: 50, fieldHeadroom: 100, medianFieldHeadroom: 2_000 }),
      ).class,
    ).toBe('marginal')
  })

  it('never calls a core-block município marginal, even with a small field', () => {
    const result = classifyMunicipalityTerritory(
      input({ ownVotes: 50, fieldHeadroom: 100, medianFieldHeadroom: 2_000, inCoreBlock: true }),
    )
    expect(result.class).toBe('expansao')
    expect(result.inCoreBlock).toBe(true)
  })

  it('drops the capture factor when the field ceiling is unknown', () => {
    const result = classifyMunicipalityTerritory(input({ captureRate: null }))
    expect(result.factors.map((factor) => factor.id)).not.toContain('capture')
  })

  it('returns sem_base without a local electorate or a statewide denominator', () => {
    expect(classifyMunicipalityTerritory(input({ validVotes: 0 })).class).toBe('sem_base')
    expect(classifyMunicipalityTerritory(input({ stateOwnVotes: 0 })).class).toBe('sem_base')
    expect(classifyMunicipalityTerritory(input({ stateValidVotes: 0 })).class).toBe('sem_base')
    expect(classifyMunicipalityTerritory(input({ validVotes: 0 })).lq).toBeNull()
    expect(classifyMunicipalityTerritory(input({ validVotes: 0 })).factors).toEqual([])
  })

  it('classifies a município with zero own votes as weak, not as an error', () => {
    const result = classifyMunicipalityTerritory(input({ ownVotes: 0, fieldHeadroom: 9_000 }))
    expect(result.class).toBe('expansao')
    expect(result.lq).toBe(0)
  })
})

describe('computeMunicipalityTerritorialClass over the committed artifact', () => {
  const classifications = municipalityCatalog.map((entry) =>
    computeMunicipalityTerritorialClass(entry.slug),
  )

  /**
   * The regression this whole item exists to prevent: the inherited absolute
   * thresholds (35/20/10) collapsed the entire state into one class, because a
   * federal-deputy candidate's local share is 1–5% everywhere. Relative
   * anchors must produce a usable spread over the real 435 municípios.
   */
  it('produces a non-degenerate distribution over the 435 catalog slugs', () => {
    const counts = new Map<MunicipalityTerritorialClass, number>()
    for (const classification of classifications) {
      counts.set(classification.class, (counts.get(classification.class) ?? 0) + 1)
    }

    for (const territorialClass of TERRITORIAL_CLASSES) {
      if (territorialClass === 'sem_base') continue
      expect(counts.get(territorialClass) ?? 0).toBeGreaterThan(0)
    }
    for (const [, count] of counts) {
      expect(count / classifications.length).toBeLessThan(0.7)
    }
  })

  it('gives every classified município a "por quê" and a finite LQ', () => {
    for (const classification of classifications) {
      if (classification.class === 'sem_base') continue
      expect(classification.factors.length).toBeGreaterThanOrEqual(2)
      expect(Number.isFinite(classification.lq ?? Number.NaN)).toBe(true)
    }
  })

  it('keeps the core block at roughly half of his statewide vote', () => {
    const coreShare = classifications
      .filter((classification) => classification.inCoreBlock)
      .reduce((total, classification) => total + classification.ownShare, 0)
    expect(coreShare).toBeGreaterThan(0.4)
    expect(coreShare).toBeLessThan(0.6)
  })

  it('memoizes: the same slug returns the identical object', () => {
    const slug = municipalityCatalog[0].slug
    expect(computeMunicipalityTerritorialClass(slug)).toBe(
      computeMunicipalityTerritorialClass(slug),
    )
  })
})

describe('territorialClassSortWeight', () => {
  it('ranks reduto first and leaves sem_base without a weight', () => {
    expect(territorialClassSortWeight.reduto).toBeGreaterThan(
      territorialClassSortWeight.expansao ?? 0,
    )
    expect(territorialClassSortWeight.expansao).toBeGreaterThan(
      territorialClassSortWeight.manutencao ?? 0,
    )
    expect(territorialClassSortWeight.manutencao).toBeGreaterThan(
      territorialClassSortWeight.marginal ?? 0,
    )
    expect(territorialClassSortWeight.sem_base).toBeNull()
  })
})
