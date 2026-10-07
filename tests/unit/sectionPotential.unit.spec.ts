import { describe, expect, it } from 'vitest'

import {
  computeSectionPotential,
  filterPotentialMunicipalities,
  findPotentialSection,
  formatPotentialPercent,
  formatPotentialPoints,
  parsePotentialShard,
  sectionStoryFileName,
  type PotentialSectionNumbers,
  type PotentialUfShard,
} from '@/lib/sectionPotential'

const numbers = (overrides: Partial<PotentialSectionNumbers> = {}): PotentialSectionNumbers => ({
  uf: 'BA',
  municipalityCode: 39098,
  municipalityName: 'Serrinha',
  zone: 150,
  section: 50,
  aptos: 376,
  comparecimento: 289,
  lula: 174,
  flavio: 76,
  validos: 260,
  ...overrides,
})

describe('computeSectionPotential', () => {
  it('refuses the plan illustrative reference (válidos above the comparecimento)', () => {
    // O exemplo do plano ("Seção 0051 Curitiba/PR: Lula 91, Flávio 81, válidos
    // 190, X₁=13, X₂=69") é uma referência de forma, marcada como "não usar na
    // UI como dado real" — e é aritmeticamente impossível: comp = Lula+Flávio+X₁
    // = 185 < válidos = 190. O cálculo falha fechado em vez de renderizar %.
    const result = computeSectionPotential({
      aptos: 241,
      comparecimento: 185,
      lula: 91,
      flavio: 81,
      validos: 190,
    })
    expect(result).toEqual({ available: false, reason: 'no-data' })
  })

  it('computes the real Serrinha/BA ZE 150 section 50 row', () => {
    const result = computeSectionPotential(numbers())
    expect(result.available).toBe(true)
    if (!result.available) return
    // X₁ = 289 − 174 − 76 = 39 (nulos + brancos + todos os terceiros);
    // X₂ = 376 − 174 − 76 = 126 (X₁ + faltantes).
    expect(result.potential.x1).toBe(39)
    expect(result.potential.x2).toBe(126)
    expect(formatPotentialPercent(result.potential.firstRoundPct)).toBe('66,9%')
    expect(formatPotentialPercent(result.potential.immediatePct)).toBe('73,7%')
    expect(formatPotentialPercent(result.potential.totalPct)).toBe('79,8%')
    expect(formatPotentialPoints(result.potential.gainImmediatePp)).toBe('+6,8 p.p.')
    expect(formatPotentialPoints(result.potential.gainTotalPp)).toBe('+12,9 p.p.')
  })

  it('never fabricates a percentage for a section without valid votes', () => {
    expect(
      computeSectionPotential({ aptos: 100, comparecimento: 0, lula: 0, flavio: 0, validos: 0 }),
    ).toEqual({ available: false, reason: 'no-data' })
  })

  it.each([
    [
      'Lula + Flávio above the comparecimento',
      { aptos: 400, comparecimento: 100, lula: 60, flavio: 60, validos: 100 },
    ],
    [
      'válidos above the comparecimento',
      { aptos: 400, comparecimento: 100, lula: 40, flavio: 40, validos: 120 },
    ],
    [
      'turnout above the electorate',
      { aptos: 90, comparecimento: 100, lula: 40, flavio: 40, validos: 80 },
    ],
    [
      'a candidate above the valid votes',
      { aptos: 400, comparecimento: 300, lula: 250, flavio: 40, validos: 200 },
    ],
  ])('fails closed on impossible counts: %s', (_label, row) => {
    expect(computeSectionPotential(row)).toEqual({ available: false, reason: 'no-data' })
  })

  it('proves the gain is never negative under the approved hypothesis', () => {
    let seed = 7
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % (max + 1)
    }
    for (let index = 0; index < 500; index += 1) {
      const aptos = 50 + random(950)
      const comparecimento = random(aptos)
      const validos = random(comparecimento)
      const lula = random(validos)
      const flavio = random(validos - lula)
      const result = computeSectionPotential({ aptos, comparecimento, lula, flavio, validos })
      if (!result.available) continue
      const { gainImmediatePp, gainTotalPp, firstRoundPct, immediatePct, totalPct } =
        result.potential
      expect(gainImmediatePp).toBeGreaterThanOrEqual(0)
      expect(gainTotalPp).toBeGreaterThanOrEqual(gainImmediatePp)
      expect(firstRoundPct).toBeGreaterThanOrEqual(0)
      expect(totalPct).toBeLessThanOrEqual(100)
      expect(immediatePct).toBeLessThanOrEqual(100)
    }
  })
})

describe('parsePotentialShard', () => {
  const valid = {
    version: 1,
    uf: 'BA',
    municipalities: [
      { code: 39098, name: 'Serrinha', sections: [[150, 50, 376, 289, 174, 76, 260]] },
    ],
  }

  it('accepts a well-formed shard', () => {
    expect(parsePotentialShard(valid)).toEqual(valid)
  })

  it.each([
    ['a wrong version', { ...valid, version: 2 }],
    ['an unknown UF', { ...valid, uf: 'XX' }],
    ['a municipality without a name', { ...valid, municipalities: [{ code: 1, sections: [] }] }],
    [
      'a row with the wrong width',
      { ...valid, municipalities: [{ code: 1, name: 'X', sections: [[1, 2, 3]] }] },
    ],
    [
      'a row with a negative count',
      { ...valid, municipalities: [{ code: 1, name: 'X', sections: [[1, 2, -3, 4, 5, 6, 7]] }] },
    ],
    ['a non-object', null],
  ])('rejects %s', (_label, value) => {
    expect(parsePotentialShard(value)).toBeNull()
  })
})

describe('findPotentialSection', () => {
  const shard: PotentialUfShard = {
    version: 1,
    uf: 'BA',
    municipalities: [
      { code: 39098, name: 'Serrinha', sections: [[150, 50, 376, 289, 174, 76, 260]] },
      { code: 40000, name: 'Outro', sections: [[1, 1, 10, 8, 4, 2, 7]] },
    ],
  }

  it('finds a section through the binary searches', () => {
    expect(
      findPotentialSection(shard, { municipalityCode: 39098, zone: 150, section: 50 }),
    ).toEqual({
      uf: 'BA',
      municipalityCode: 39098,
      municipalityName: 'Serrinha',
      zone: 150,
      section: 50,
      aptos: 376,
      comparecimento: 289,
      lula: 174,
      flavio: 76,
      validos: 260,
    })
  })

  it('answers null for an unknown município or section', () => {
    expect(findPotentialSection(shard, { municipalityCode: 1, zone: 1, section: 1 })).toBeNull()
    expect(findPotentialSection(shard, { municipalityCode: 39098, zone: 1, section: 1 })).toBeNull()
  })
})

describe('formatters and helpers', () => {
  it('formats percentages with one pt-BR decimal', () => {
    expect(formatPotentialPercent(66.923)).toBe('66,9%')
    expect(formatPotentialPercent(0)).toBe('0,0%')
  })

  it('derives the sign of the gain instead of hardcoding "+"', () => {
    expect(formatPotentialPoints(6.864)).toBe('+6,9 p.p.')
    expect(formatPotentialPoints(0)).toBe('+0,0 p.p.')
    expect(formatPotentialPoints(-1.24)).toBe('−1,2 p.p.')
  })

  it('names the story file from the section identity', () => {
    expect(sectionStoryFileName(numbers())).toBe('potencial-lula-ba-serrinha-z150-s50.png')
  })

  it('filters municípios accent-insensitively from three letters', () => {
    const municipalities = [
      { code: 1, name: 'Serrinha' },
      { code: 2, name: 'São Gonçalo dos Campos' },
      { code: 3, name: 'Feira de Santana' },
    ]
    expect(filterPotentialMunicipalities(municipalities, 'ser')).toEqual([
      { code: 1, name: 'Serrinha' },
    ])
    expect(filterPotentialMunicipalities(municipalities, 'sao goncalo')).toEqual([
      { code: 2, name: 'São Gonçalo dos Campos' },
    ])
    expect(filterPotentialMunicipalities(municipalities, 'se')).toEqual([])
  })
})
