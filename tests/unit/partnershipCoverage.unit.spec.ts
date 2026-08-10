import { describe, expect, it } from 'vitest'

import {
  groupCoverageByCity,
  PARTNERSHIP_COVERAGE_CRITERION,
  resolveIdentityTerritory,
  sortCoverageUnits,
  sortOrphanDobradinhas,
  type PartnershipCoverageUnit,
} from '@/lib/partnershipCoverage'

const unit = (
  overrides: Partial<PartnershipCoverageUnit> & Pick<PartnershipCoverageUnit, 'nome' | 'slug'>,
): PartnershipCoverageUnit => ({
  cidade: 'Feira de Santana',
  regiao: 'Portal do Sertão',
  zoneNumber: null,
  ...overrides,
})

describe('resolveIdentityTerritory', () => {
  it('resolves a canonical territory name', () => {
    expect(resolveIdentityTerritory('Vale do Jiquiriçá')).toBe('Vale do Jiquiriçá')
  })

  it('is tolerant to missing accents and case (B185 family semantics)', () => {
    expect(resolveIdentityTerritory('vale do jiquirica')).toBe('Vale do Jiquiriçá')
  })

  it('returns undefined for an unknown name', () => {
    expect(resolveIdentityTerritory('Planeta Marte')).toBeUndefined()
  })
})

describe('sortCoverageUnits', () => {
  it('orders by region, then city, then zone number', () => {
    const units = sortCoverageUnits([
      unit({
        nome: 'Salvador — ZE 10',
        slug: 'salvador-ze-10',
        cidade: 'Salvador',
        regiao: 'Metropolitano de Salvador',
        zoneNumber: 10,
      }),
      unit({
        nome: 'Salvador — ZE 2',
        slug: 'salvador-ze-2',
        cidade: 'Salvador',
        regiao: 'Metropolitano de Salvador',
        zoneNumber: 2,
      }),
      unit({
        nome: 'Camaçari',
        slug: 'camacari',
        cidade: 'Camaçari',
        regiao: 'Metropolitano de Salvador',
      }),
      unit({ nome: 'Abaré', slug: 'abare', cidade: 'Abaré', regiao: 'Sertão do São Francisco' }),
    ])

    // Same region: city asc decides (Camaçari before Salvador), then zone asc.
    expect(units.map((entry) => entry.slug)).toEqual([
      'camacari',
      'salvador-ze-2',
      'salvador-ze-10',
      'abare',
    ])
  })

  it('sorts whole municipalities of a city after its zones', () => {
    const units = sortCoverageUnits([
      unit({ nome: 'Salvador — ZE 1', slug: 'salvador-ze-1', cidade: 'Salvador', zoneNumber: 1 }),
      unit({ nome: 'Salvador', slug: 'salvador', cidade: 'Salvador', zoneNumber: null }),
    ])

    expect(units.map((entry) => entry.slug)).toEqual(['salvador-ze-1', 'salvador'])
  })
})

describe('groupCoverageByCity', () => {
  it('folds Salvador zones into one city row with the city slug (B178)', () => {
    const rows = groupCoverageByCity(
      sortCoverageUnits([
        unit({ nome: 'Salvador — ZE 1', slug: 'salvador-ze-1', cidade: 'Salvador', zoneNumber: 1 }),
        unit({ nome: 'Salvador — ZE 3', slug: 'salvador-ze-3', cidade: 'Salvador', zoneNumber: 3 }),
      ]),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      nome: 'Salvador',
      slug: 'salvador',
      cidade: 'Salvador',
      unidades: 2,
    })
    expect(rows[0]!.zonas.map((zona) => zona.slug)).toEqual(['salvador-ze-1', 'salvador-ze-3'])
  })

  it('keeps whole-municipality cities as one row with their own slug', () => {
    const rows = groupCoverageByCity(
      sortCoverageUnits([unit({ nome: 'Ilhéus', slug: 'ilheus', cidade: 'Ilhéus' })]),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nome: 'Ilhéus', slug: 'ilheus', unidades: 1 })
    expect(rows[0]!.zonas).toEqual([{ nome: 'Ilhéus', slug: 'ilheus' }])
  })

  it('preserves region/city ordering across rows', () => {
    const rows = groupCoverageByCity(
      sortCoverageUnits([
        unit({ nome: 'Abaré', slug: 'abare', cidade: 'Abaré', regiao: 'Sertão do São Francisco' }),
        unit({ nome: 'Salvador — ZE 1', slug: 'salvador-ze-1', cidade: 'Salvador', zoneNumber: 1 }),
        unit({
          nome: 'Camaçari',
          slug: 'camacari',
          cidade: 'Camaçari',
          regiao: 'Metropolitano de Salvador',
        }),
      ]),
    )

    expect(rows.map((row) => row.cidade)).toEqual(['Camaçari', 'Salvador', 'Abaré'])
  })
})

describe('sortOrphanDobradinhas', () => {
  it('sorts orphans by name in pt-BR', () => {
    const rows = sortOrphanDobradinhas([
      { nome: 'Zé', slug: 'ze' },
      { nome: 'Ana', slug: 'ana' },
      { nome: 'Álvaro', slug: 'alvaro' },
    ])

    expect(rows.map((row) => row.nome)).toEqual(['Álvaro', 'Ana', 'Zé'])
  })
})

describe('PARTNERSHIP_COVERAGE_CRITERION', () => {
  it('declares the registry-scope criterion for both modes', () => {
    expect(PARTNERSHIP_COVERAGE_CRITERION.municipalities).toMatch(/cadastro atual/)
    expect(PARTNERSHIP_COVERAGE_CRITERION.orphanDeputies).toMatch(/cadastro atual/)
  })
})
