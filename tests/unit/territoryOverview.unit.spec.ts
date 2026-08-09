import { describe, expect, it } from 'vitest'

import {
  METROPOLITANO_DEMAIS_SUB_ROW_LABEL,
  METROPOLITANO_SALVADOR_SUB_ROW_LABEL,
} from '@/lib/metropolitanoTerritoryPeers'
import {
  computeTerritoryE12Rollup,
  computeTerritoryRollup,
  filterTerritoryRows,
  flattenTerritoryRows,
  meanCaptureRateOfMunicipalities,
  sortTerritoryRows,
  type TerritoryMunicipalityInput,
} from '@/utilities/territory/territoryOverview'

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
  estimateByScenario: { pessimistic: 0, central: 0, optimistic: 0 },
  hasEstimate: false,
  advisorIDs: [],
  leadershipIDs: [],
  stateDeputyIDs: [],
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
    estimateByScenario: { pessimistic: 35, central: 40, optimistic: 45 },
    hasEstimate: true,
    advisorIDs: [7],
    leadershipIDs: [11, 12],
    stateDeputyIDs: [1, 2],
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
    estimateByScenario: { pessimistic: 33, central: 35, optimistic: 37 },
    advisorIDs: [],
    leadershipIDs: [11],
    stateDeputyIDs: [2, 3],
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
    estimateByScenario: { pessimistic: 140, central: 150, optimistic: 160 },
    hasEstimate: true,
    advisorIDs: [7, 8],
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
    estimateByScenario: { pessimistic: 1200, central: 1300, optimistic: 1400 },
    hasEstimate: true,
    advisorIDs: [9],
    stateDeputyIDs: [5],
    ownVotes2022: 1200,
    fieldCeiling2022: 12000,
  }),
  input({
    slug: 'camacari',
    region: 'Metropolitano de Salvador',
    city: 'Camaçari',
    votesByYear: { 2014: 200, 2018: 210, 2022: 220 },
    validVotesByYear: { 2022: 8000 },
    estimateByScenario: { pessimistic: 240, central: 250, optimistic: 260 },
    advisorIDs: [10],
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

  it('sums 2026 estimates per scenario', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    expect(irece.estimateByScenario).toEqual({
      pessimistic: 68,
      central: 75,
      optimistic: 82,
    })
  })

  it('flags a territory as having an estimate when any municipality does', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    const metro = rows.find((row) => row.region === 'Metropolitano de Salvador')!
    expect(irece.hasEstimate).toBe(true)
    expect(metro.hasEstimate).toBe(true)
    const allEmpty = computeTerritoryRollup([
      input({ slug: 'x', region: 'Velho Chico', city: 'X' }),
    ])
    expect(allEmpty[0].hasEstimate).toBe(false)
  })

  it('unions advisors, leaderships and state deputies per territory (dedup)', () => {
    const irece = rows.find((row) => row.region === 'Irecê')!
    const velhoChico = rows.find((row) => row.region === 'Velho Chico')!
    const metro = rows.find((row) => row.region === 'Metropolitano de Salvador')!
    expect(irece.advisorIDs).toEqual([7])
    expect(irece.leadershipIDs).toEqual([11, 12])
    expect(irece.stateDeputyIDs).toEqual([1, 2, 3])
    expect(velhoChico.advisorIDs).toEqual([7, 8])
    expect(metro.advisorIDs).toEqual([9, 10])
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
    expect(salvador.label).toBe(METROPOLITANO_SALVADOR_SUB_ROW_LABEL)
    expect(demais.label).toBe(METROPOLITANO_DEMAIS_SUB_ROW_LABEL)
    expect(salvador.municipalityCount).toBe(1)
    expect(demais.municipalityCount).toBe(1)
    // Sub-rows sum to the Metropolitano total.
    expect(salvador.votesByYear[2022] + demais.votesByYear[2022]).toBe(metro.votesByYear[2022])
    expect(salvador.estimateByScenario.central + demais.estimateByScenario.central).toBe(
      metro.estimateByScenario.central,
    )
    // Sub-rows carry their own network sets (Salvador zones × Demais RMS).
    expect(salvador.advisorIDs).toEqual([9])
    expect(demais.advisorIDs).toEqual([10])
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
      label: METROPOLITANO_SALVADOR_SUB_ROW_LABEL,
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
    // Velho Chico (1/1) and Metropolitano (Salvador + Camaçari both with advisor) are complete.
    expect(
      filterTerritoryRows(rows, { coverage: 'com_assessor' }).map((row) => row.region),
    ).toEqual(['Velho Chico', 'Metropolitano de Salvador'])
    // Irecê has only ibipeba with an advisor → a gap.
    expect(
      filterTerritoryRows(rows, { coverage: 'sem_assessor' }).map((row) => row.region),
    ).toEqual(['Irecê'])
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
