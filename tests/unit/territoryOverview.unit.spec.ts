import { describe, expect, it } from 'vitest'

import {
  computeTerritoryE12Rollup,
  computeTerritoryRollup,
  filterTerritoryRows,
  flattenTerritoryRows,
  meanCaptureRateOfMunicipalities,
  sortTerritoryRows,
  type TerritoryMunicipalityInput,
} from '@/utilities/territoryOverview'

const emptyGoalCoverage = {
  goal: 0,
  committed: 0,
  coverageRatio: null as number | null,
  deficit: 0,
}

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
  ownVotes2022: 0,
  fieldCeiling2022: 0,
  goalCoverage: emptyGoalCoverage,
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
    ownVotes2022: 30,
    fieldCeiling2022: 300,
    goalCoverage: { goal: 100, committed: 20, coverageRatio: 0.2, deficit: 80 },
  }),
  input({
    slug: 'irece',
    region: 'Irecê',
    city: 'Irecê',
    votesByYear: { 2014: 5, 2018: 15, 2022: 25 },
    validVotesByYear: { 2022: 2000 },
    estimate2026: 35,
    advisorCount: 0,
    ownVotes2022: 25,
    fieldCeiling2022: 100,
    goalCoverage: { goal: 50, committed: 10, coverageRatio: 0.2, deficit: 40 },
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
    ownVotes2022: 120,
    fieldCeiling2022: 1200,
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
    ownVotes2022: 1200,
    fieldCeiling2022: 12000,
  }),
  input({
    slug: 'camacari',
    region: 'Metropolitano de Salvador',
    city: 'Camaçari',
    votesByYear: { 2014: 200, 2018: 210, 2022: 220 },
    validVotesByYear: { 2022: 8000 },
    estimate2026: 250,
    advisorCount: 0,
    ownVotes2022: 220,
    fieldCeiling2022: 2200,
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

describe('flattenTerritoryRows', () => {
  it('places Metropolitano sub-rows immediately after their parent', () => {
    const rows = sortTerritoryRows(computeTerritoryRollup(fixture), 'region', 'asc')
    const flattened = flattenTerritoryRows(rows)
    const metroIndex = flattened.findIndex(
      (row) => row.variant === 'parent' && row.region === 'Metropolitano de Salvador',
    )

    expect(flattened.slice(metroIndex, metroIndex + 3).map((row) => row.variant)).toEqual([
      'parent',
      'sub',
      'sub',
    ])
    expect(flattened[metroIndex + 1]).toMatchObject({
      variant: 'sub',
      parentRegion: 'Metropolitano de Salvador',
      label: 'Salvador (19 zonas)',
    })
  })
})

describe('filterTerritoryRows', () => {
  const rows = computeTerritoryRollup(fixture)

  it('combines accent-insensitive search and selected regions', () => {
    expect(
      filterTerritoryRows(rows, {
        q: 'irece',
        regions: ['Irecê', 'Velho Chico'],
      }).map((row) => row.region),
    ).toEqual(['Irecê'])
  })

  it('treats com assessor as complete coverage and sem assessor as any gap', () => {
    expect(
      filterTerritoryRows(rows, { coverage: 'com_assessor' }).map((row) => row.region),
    ).toEqual(['Velho Chico'])
    expect(
      filterTerritoryRows(rows, { coverage: 'sem_assessor' }).map((row) => row.region),
    ).toEqual(['Irecê', 'Metropolitano de Salvador'])
  })

  it('keeps Metropolitano sub-rows attached when the parent matches', () => {
    const [metropolitano] = filterTerritoryRows(rows, { q: 'metropolitano' })
    expect(metropolitano.subRows).toHaveLength(2)
  })
})

describe('computeTerritoryE12Rollup (MAUP)', () => {
  const rows = computeTerritoryRollup(fixture)

  it('uses ratio of aggregates, not mean of ratios, when municipalities differ', () => {
    const heterogeneous: TerritoryMunicipalityInput[] = [
      input({
        slug: 'a',
        region: 'Irecê',
        city: 'A',
        ownVotes2022: 10,
        fieldCeiling2022: 100,
        goalCoverage: emptyGoalCoverage,
      }),
      input({
        slug: 'b',
        region: 'Irecê',
        city: 'B',
        ownVotes2022: 90,
        fieldCeiling2022: 100,
        goalCoverage: emptyGoalCoverage,
      }),
    ]
    const rollup = computeTerritoryE12Rollup(heterogeneous)
    const mean = meanCaptureRateOfMunicipalities(heterogeneous)
    expect(rollup.captureRate).toBeCloseTo(0.5, 6)
    expect(mean).toBeCloseTo(0.5, 6)
    // Same in this symmetric case — use skewed ceilings to diverge.
    const skewed: TerritoryMunicipalityInput[] = [
      input({
        slug: 'low',
        region: 'Irecê',
        city: 'Low',
        ownVotes2022: 10,
        fieldCeiling2022: 1000,
        goalCoverage: emptyGoalCoverage,
      }),
      input({
        slug: 'high',
        region: 'Irecê',
        city: 'High',
        ownVotes2022: 90,
        fieldCeiling2022: 100,
        goalCoverage: emptyGoalCoverage,
      }),
    ]
    const skewedRollup = computeTerritoryE12Rollup(skewed)
    const skewedMean = meanCaptureRateOfMunicipalities(skewed)!
    expect(skewedRollup.captureRate).toBeCloseTo(100 / 1100, 6)
    expect(skewedMean).not.toBeCloseTo(skewedRollup.captureRate!, 4)
  })

  it('names the municipality with the largest goal deficit as critical', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    expect(irece.criticalMunicipality).toEqual({
      slug: 'ibipeba',
      name: 'ibipeba',
      deficit: 80,
    })
    expect(irece.goalCoverage.goal).toBe(150)
    expect(irece.goalCoverage.committed).toBe(30)
  })

  it('computes capture stats on Metropolitano sub-rows', () => {
    const metro = rows.find((row) => row.region === 'Metropolitano de Salvador')!
    const salvador = metro.subRows![0]
    expect(salvador.captureRate).not.toBeNull()
    expect(salvador.medianCapture).not.toBeNull()
  })
})
