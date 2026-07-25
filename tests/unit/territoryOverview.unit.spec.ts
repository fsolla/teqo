import { describe, expect, it } from 'vitest'

import {
  computeTerritoryRollup,
  sortTerritoryRows,
  type TerritoryMunicipalityInput,
} from '@/utilities/territoryOverview'

const input = (
  overrides: Partial<TerritoryMunicipalityInput> &
    Pick<TerritoryMunicipalityInput, 'slug' | 'region' | 'city'>,
): TerritoryMunicipalityInput => ({
  name: overrides.slug,
  kind: 'municipio',
  votesByYear: { 2022: 0 },
  validVotesByYear: { 2022: 0 },
  estimate2026: 0,
  advisorCount: 0,
  ...overrides,
})

const fixture: TerritoryMunicipalityInput[] = [
  // Irecê (TI 01) — 2 municípios, 1 com assessor
  input({
    slug: 'ibipeba',
    region: 'Irecê',
    city: 'Ibipeba',
    votesByYear: { 2014: 10, 2018: 20, 2022: 30 },
    validVotesByYear: { 2022: 1000 },
    estimate2026: 40,
    advisorCount: 1,
  }),
  input({
    slug: 'irece',
    region: 'Irecê',
    city: 'Irecê',
    votesByYear: { 2014: 5, 2018: 15, 2022: 25 },
    validVotesByYear: { 2022: 2000 },
    estimate2026: 35,
    advisorCount: 0,
  }),
  // Velho Chico (TI 02) — 1 município, com assessor
  input({
    slug: 'barra',
    region: 'Velho Chico',
    city: 'Barra',
    votesByYear: { 2014: 100, 2018: 110, 2022: 120 },
    validVotesByYear: { 2022: 5000 },
    estimate2026: 150,
    advisorCount: 2,
  }),
  // Metropolitano de Salvador (TI 26) — Salvador (1 zona) + Camaçari (demais)
  input({
    slug: 'salvador-ze-1',
    region: 'Metropolitano de Salvador',
    city: 'Salvador',
    kind: 'zona',
    votesByYear: { 2014: 1000, 2018: 1100, 2022: 1200 },
    validVotesByYear: { 2022: 40000 },
    estimate2026: 1300,
    advisorCount: 1,
  }),
  input({
    slug: 'camacari',
    region: 'Metropolitano de Salvador',
    city: 'Camaçari',
    votesByYear: { 2014: 200, 2018: 210, 2022: 220 },
    validVotesByYear: { 2022: 8000 },
    estimate2026: 250,
    advisorCount: 0,
  }),
]

describe('computeTerritoryRollup', () => {
  const rows = computeTerritoryRollup(fixture)

  it('returns one row per TI (3 regions)', () => {
    expect(rows.map((row) => row.region).sort()).toEqual(
      ['Irecê', 'Metropolitano de Salvador', 'Velho Chico'].sort(),
    )
  })

  it('sums votes per year and valid votes 2022', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    expect(irece.votesByYear).toEqual({ 2014: 15, 2018: 35, 2022: 55 })
    expect(irece.validVotes2022).toBe(3000)
    expect(irece.municipalityCount).toBe(2)
  })

  it('sums 2026 estimates', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    expect(irece.estimate2026).toBe(75)
  })

  it('counts municipalities with advisor', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    expect(irece.withAdvisorCount).toBe(1)
  })

  it('computes % da própria votação as fraction of state total', () => {
    const stateTotal2022 = 30 + 25 + 120 + 1200 + 220 // 1395
    const velhoChico = rows.find((row) => row.region === 'Velho Chico')!
    expect(velhoChico.pctPropriaVotacao).toBeCloseTo(120 / stateTotal2022, 6)
  })

  it('decomposes Metropolitano into Salvador + Demais RMS sub-rows', () => {
    const metro = rows.find((row) => row.region === 'Metropolitano de Salvador')!
    expect(metro.subRows).toHaveLength(2)
    const salvador = metro.subRows![0]
    const demais = metro.subRows![1]
    expect(salvador.label).toBe('Salvador (19 zonas)')
    expect(demais.label).toBe('Demais municípios da RMS')
    expect(salvador.municipalityCount).toBe(1)
    expect(demais.municipalityCount).toBe(1)
    // Sub-rows sum to the Metropolitano total.
    expect(salvador.votesByYear[2022] + demais.votesByYear[2022]).toBe(metro.votesByYear[2022])
    expect(salvador.estimate2026 + demais.estimate2026).toBe(metro.estimate2026)
  })

  it('returns zero % when state total is zero', () => {
    const empty = computeTerritoryRollup([input({ slug: 'x', region: 'Irecê', city: 'X' })])
    expect(empty[0].pctPropriaVotacao).toBe(0)
  })
})

describe('sortTerritoryRows', () => {
  const rows = computeTerritoryRollup(fixture)

  it('sorts by % da própria votação desc by default', () => {
    const sorted = sortTerritoryRows(rows, 'pct')
    expect(sorted[0].region).toBe('Metropolitano de Salvador')
  })

  it('keeps Metropolitano sub-rows attached to the parent', () => {
    const sorted = sortTerritoryRows(rows, 'municipalities', 'asc')
    const metro = sorted.find((row) => row.region === 'Metropolitano de Salvador')!
    expect(metro.subRows).toHaveLength(2)
  })

  it('sorts ascending when dir=asc', () => {
    const sorted = sortTerritoryRows(rows, 'votes2022', 'asc')
    expect(sorted[0].votesByYear[2022] ?? 0).toBeLessThanOrEqual(
      sorted[sorted.length - 1].votesByYear[2022] ?? 0,
    )
  })
})
