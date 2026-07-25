import { describe, expect, it } from 'vitest'

import {
  getMunicipalityFederalBaseline,
  type MunicipalityFederalBaseline,
} from '@/lib/bahiaElectionAggregates'
import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  captureRate,
  deriveSuggestedGoalsByScenario,
  fieldCeiling,
  intraFieldShare,
  ownVotes2022,
  projectedFieldCeiling,
  projectedValidVotes,
  rollOff,
  sanityCheckSuggestedGoalsByTerritory,
  type MunicipalityPotential,
} from '@/utilities/municipalityPotential'

const baseline = (
  overrides: Partial<MunicipalityFederalBaseline> = {},
): MunicipalityFederalBaseline => ({
  votesByYear: {},
  validVotesByYear: {},
  campoFederalVotesByYear: {},
  federalTallyByYear: {},
  ...overrides,
})

describe('projectedValidVotes', () => {
  it('weights 2022 double: (v2014 + v2018 + 2×v2022) / 4', () => {
    const b = baseline({ validVotesByYear: { '2014': 1000, '2018': 2000, '2022': 3000 } })
    // (1000 + 2000 + 2*3000) / 4 = 9000 / 4 = 2250
    expect(projectedValidVotes(b)).toBe(2250)
  })

  it('treats missing years as zero', () => {
    const b = baseline({ validVotesByYear: { '2022': 4000 } })
    expect(projectedValidVotes(b)).toBe(2000)
  })
})

describe('fieldCeiling / projectedFieldCeiling', () => {
  it('reads the 2022 president #13 votes as the primary ceiling', () => {
    const b = baseline({
      majoritarian2022: {
        president: {
          votes: 5000,
          comparecimento: 8000,
          votosValidos: 7500,
          votosBranco: 300,
          votosNulo: 200,
        },
        governor: {
          votes: 5500,
          comparecimento: 8000,
          votosValidos: 7500,
          votosBranco: 300,
          votosNulo: 200,
        },
      },
    })
    expect(fieldCeiling(b)).toBe(5000)
  })

  it('is 0 when no majoritarian data is seeded for the slug', () => {
    expect(fieldCeiling(baseline())).toBe(0)
  })

  it('scales the ceiling by the projected/observed 2022 valid-vote ratio', () => {
    const b = baseline({
      validVotesByYear: { '2014': 4000, '2018': 6000, '2022': 8000 },
      majoritarian2022: {
        president: {
          votes: 5000,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
        governor: {
          votes: 5200,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
      },
    })
    // projected = (4000 + 6000 + 2*8000) / 4 = 6500; ratio = 6500/8000 = 0.8125
    expect(projectedFieldCeiling(b)).toBeCloseTo(5000 * 0.8125, 6)
  })

  it('falls back to the unscaled ceiling when 2022 valid votes are unknown', () => {
    const b = baseline({
      majoritarian2022: {
        president: {
          votes: 5000,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
        governor: {
          votes: 5200,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
      },
    })
    expect(projectedFieldCeiling(b)).toBe(5000)
  })
})

describe('captureRate', () => {
  it('is Solla 2022 votes over the 2022 field ceiling', () => {
    const b = baseline({
      votesByYear: { '2022': 1000 },
      majoritarian2022: {
        president: {
          votes: 5000,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
        governor: {
          votes: 5200,
          comparecimento: 9000,
          votosValidos: 8500,
          votosBranco: 300,
          votosNulo: 200,
        },
      },
    })
    expect(captureRate(b)).toBeCloseTo(0.2, 6)
  })

  it('is null when the ceiling is unknown', () => {
    expect(captureRate(baseline({ votesByYear: { '2022': 1000 } }))).toBeNull()
  })
})

describe('intraFieldShare', () => {
  it('is Solla votes over the curated campo federal votes, per year', () => {
    const b = baseline({
      votesByYear: { '2018': 800 },
      campoFederalVotesByYear: { '2018': 2000 },
    })
    expect(intraFieldShare(b, 2018)).toBeCloseTo(0.4, 6)
  })

  it('is null when the field polled zero that year', () => {
    expect(intraFieldShare(baseline(), 2018)).toBeNull()
  })
})

describe('rollOff', () => {
  it('is (brancos+nulos DF) − (brancos+nulos majoritária), with percent of turnout', () => {
    const b = baseline({
      federalTallyByYear: {
        '2022': { comparecimento: 10_000, votosValidos: 9000, votosBranco: 600, votosNulo: 400 },
      },
      majoritarian2022: {
        president: {
          votes: 5000,
          comparecimento: 10_000,
          votosValidos: 9600,
          votosBranco: 250,
          votosNulo: 150,
        },
        governor: {
          votes: 5200,
          comparecimento: 10_000,
          votosValidos: 9600,
          votosBranco: 250,
          votosNulo: 150,
        },
      },
    })
    // DF blank+null = 1000; majoritarian blank+null = 400; roll-off = 600
    const result = rollOff(b)
    expect(result).not.toBeNull()
    expect(result?.votes).toBe(600)
    expect(result?.percentOfTurnout).toBeCloseTo(0.06, 6)
  })

  it('is null (2022-only diagnostic) when the majoritarian tally is missing', () => {
    const b = baseline({
      federalTallyByYear: {
        '2022': { comparecimento: 10_000, votosValidos: 9000, votosBranco: 600, votosNulo: 400 },
      },
    })
    expect(rollOff(b)).toBeNull()
  })

  it('is null for years without a seeded federal tally (2014/2018)', () => {
    expect(rollOff(baseline())).toBeNull()
  })
})

/**
 * E9 revision of the E8 formula: the suggested goal is anchored on the
 * candidate's OWN 2022 vote per município, not on the field's majoritarian
 * ceiling. The three scenarios are the same anchor at three ambitions, and
 * `stateGoal` survives as the optimistic growth factor so the seat account
 * still closes exactly.
 */
describe('deriveSuggestedGoalsByScenario', () => {
  const catalogSlugs = () => municipalityCatalog.map((entry) => entry.slug)

  it('central repeats the own 2022 vote, and Σ optimistic equals the state goal exactly', () => {
    const slugs = catalogSlugs()
    const { suggestedGoalBySlug, baseTotal, growthFactor, belowBase } =
      deriveSuggestedGoalsByScenario(slugs, { stateGoal: 150_000, margin: 10 })

    expect(suggestedGoalBySlug.size).toBe(slugs.length)
    expect(belowBase).toBe(false)
    expect(growthFactor).toBeGreaterThan(1)

    const goals = [...suggestedGoalBySlug.values()]
    const sum = (scenario: 'pessimistic' | 'central' | 'optimistic') =>
      goals.reduce((total, goal) => total + goal[scenario], 0)

    expect(sum('central')).toBeCloseTo(baseTotal, 6)
    expect(sum('optimistic')).toBeCloseTo(150_000, 4)
    expect(sum('pessimistic')).toBeCloseTo(baseTotal * 0.9, 4)
  })

  it('keeps a stronghold at or above the votes it already produced (the E8 formula did not)', () => {
    const slug = 'vitoria-da-conquista'
    const own2022 = ownVotes2022(getMunicipalityFederalBaseline(slug))
    expect(own2022).toBeGreaterThan(1000) // guards the fixture, not the formula

    const { suggestedGoalBySlug } = deriveSuggestedGoalsByScenario(catalogSlugs(), {
      stateGoal: 150_000,
      margin: 10,
    })
    const goal = suggestedGoalBySlug.get(slug)

    expect(goal?.central).toBe(own2022)
    expect(goal?.optimistic).toBeGreaterThan(own2022)
  })

  it('leaves a desert near its own vote instead of inflating it (E8 asked 813 for 47 votes)', () => {
    const slug = 'campo-formoso'
    const own2022 = ownVotes2022(getMunicipalityFederalBaseline(slug))
    expect(own2022).toBeLessThan(100) // guards the fixture, not the formula

    const { suggestedGoalBySlug, growthFactor } = deriveSuggestedGoalsByScenario(catalogSlugs(), {
      stateGoal: 150_000,
      margin: 10,
    })
    const goal = suggestedGoalBySlug.get(slug)

    // Growth is the same statewide factor everywhere — a desert cannot be
    // handed a goal an order of magnitude above the votes it produced.
    expect(goal?.optimistic).toBeCloseTo(own2022 * growthFactor, 6)
    expect(goal?.optimistic).toBeLessThan(own2022 * 2)
  })

  it('clamps the growth factor at 1 when the state goal sits below the projected base', () => {
    const { suggestedGoalBySlug, baseTotal, growthFactor, belowBase } =
      deriveSuggestedGoalsByScenario(catalogSlugs(), { stateGoal: 1000, margin: 10 })

    expect(belowBase).toBe(true)
    expect(growthFactor).toBe(1)

    const goals = [...suggestedGoalBySlug.values()]
    // An "optimistic" scenario must never land below central.
    for (const goal of goals) expect(goal.optimistic).toBeGreaterThanOrEqual(goal.central)
    expect(goals.reduce((total, goal) => total + goal.optimistic, 0)).toBeCloseTo(baseTotal, 6)
  })

  it('defaults the pessimistic haircut to 10% when margin is unset, and clamps a mistyped one', () => {
    const slugs = catalogSlugs()
    const unset = deriveSuggestedGoalsByScenario(slugs, { stateGoal: 150_000, margin: null })
    const mistyped = deriveSuggestedGoalsByScenario(slugs, { stateGoal: 150_000, margin: 500 })

    const slug = 'vitoria-da-conquista'
    const own2022 = ownVotes2022(getMunicipalityFederalBaseline(slug))

    expect(unset.suggestedGoalBySlug.get(slug)?.pessimistic).toBeCloseTo(own2022 * 0.9, 6)
    expect(mistyped.suggestedGoalBySlug.get(slug)?.pessimistic).toBe(0)
  })

  it('returns an empty map for an empty slug list (never NaN)', () => {
    const result = deriveSuggestedGoalsByScenario([], { stateGoal: 150_000, margin: 10 })
    expect(result.suggestedGoalBySlug.size).toBe(0)
    expect(result.baseTotal).toBe(0)
    expect(result.growthFactor).toBe(1)
    expect(result.belowBase).toBe(false)
  })

  it('gives an unknown slug a zero goal in every scenario', () => {
    const { suggestedGoalBySlug } = deriveSuggestedGoalsByScenario(['nao-existe'], {
      stateGoal: 150_000,
      margin: 10,
    })
    expect(suggestedGoalBySlug.get('nao-existe')).toEqual({
      pessimistic: 0,
      central: 0,
      optimistic: 0,
    })
  })
})

describe('sanityCheckSuggestedGoalsByTerritory', () => {
  const region = 'Litoral Sul' as BahiaIdentityTerritory
  const otherRegion = 'Chapada Diamantina' as BahiaIdentityTerritory

  it('never blocks — always returns an array, even when nothing is out of range', () => {
    const warnings = sanityCheckSuggestedGoalsByTerritory([
      { region, suggestedGoal: 5000, projectedValidVotes: 20_000 },
    ])
    expect(warnings).toEqual([])
  })

  it('flags a territory whose decomposed goal total exceeds its projected electorate', () => {
    const warnings = sanityCheckSuggestedGoalsByTerritory([
      { region, suggestedGoal: 15_000, projectedValidVotes: 10_000 },
      { region: otherRegion, suggestedGoal: 4_000, projectedValidVotes: 10_000 },
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.region).toBe(region)
    expect(warnings[0]?.ratio).toBeCloseTo(1.5, 6)
  })

  it('ignores territories with no projected electorate (avoids a divide-by-zero false positive)', () => {
    const warnings = sanityCheckSuggestedGoalsByTerritory([
      { region, suggestedGoal: 1000, projectedValidVotes: 0 },
    ])
    expect(warnings).toEqual([])
  })
})

describe('computeMunicipalityPotential / computeAllMunicipalityPotentials (real artifact)', () => {
  it('returns a well-shaped potential for a real catalog slug and a zeroed one for an unknown slug', async () => {
    const { computeMunicipalityPotential } = await import('@/utilities/municipalityPotential')

    const realSlug = municipalityCatalog[0]!.slug
    const real: MunicipalityPotential = computeMunicipalityPotential(realSlug)
    expect(real.slug).toBe(realSlug)
    expect(real.projectedValidVotes).toBeGreaterThanOrEqual(0)
    expect(real.projectedFieldCeiling).toBeGreaterThanOrEqual(0)

    const unknown = computeMunicipalityPotential('nao-existe')
    expect(unknown.projectedValidVotes).toBe(0)
    expect(unknown.fieldCeiling2022).toBe(0)
    expect(unknown.rollOff2022).toBeNull()
  })

  it('computeAllMunicipalityPotentials covers exactly the municipality catalog', async () => {
    const { computeAllMunicipalityPotentials } = await import('@/utilities/municipalityPotential')

    const potentials = computeAllMunicipalityPotentials()
    expect(potentials).toHaveLength(municipalityCatalog.length)
  })
})
