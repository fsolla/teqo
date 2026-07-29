import { describe, expect, it } from 'vitest'

import {
  aggregateGoalCoverage,
  computeGoalCoverage,
  computeGoalCoverageByScenario,
  formatGoalCoverageDeficitLabel,
} from '@/utilities/municipality/goalCoverage'
import type { SuggestedGoalByScenario } from '@/utilities/municipality/municipalityPotential'
import { createEmptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

/** Suggested goal ladder shaped like `deriveSuggestedGoalsByScenario` output. */
const suggested = (
  central: number,
  { pessimistic = central * 0.9, optimistic = central * 1.16 } = {},
): SuggestedGoalByScenario => ({ pessimistic, central, optimistic })

/**
 * Fixes the meta×comprometido semantics locked in the E8 plan audit: a
 * municipality can have `expectedVotes` filled by the E4R projection-sheet
 * import with ZERO pledges behind it — coverage must report that gap, not
 * 100% (which is what `resolveMunicipalityStaffVoteTotal`'s override
 * behavior would give if reused here).
 */
describe('computeGoalCoverage', () => {
  it('meta = expectedVotes[cenário] when set; comprometido = pledge aggregate only (never the override)', () => {
    // Feira de Santana-style case: mesa expects 3000 (E4R sheet, cenário média),
    // but only 1200 is backed by declared/estimated pledges.
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    aggregate.effectiveByScenario.central = 1200

    const coverage = computeGoalCoverage({ central: 3000 }, suggested(5000), aggregate, 'central')

    expect(coverage.goal).toBe(3000) // NOT 100% — expectedVotes wins over suggestedGoal, not over pledges
    expect(coverage.committed).toBe(1200)
    expect(coverage.coverageRatio).toBeCloseTo(0.4, 6)
    expect(coverage.deficit).toBe(1800)
  })

  it('falls back to suggestedGoal when expectedVotes is unset for that scenario', () => {
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    aggregate.effectiveByScenario.central = 400

    const coverage = computeGoalCoverage(null, suggested(1000), aggregate, 'central')
    expect(coverage.goal).toBe(1000)
    expect(coverage.committed).toBe(400)
    expect(coverage.coverageRatio).toBeCloseTo(0.4, 6)
  })

  it('coverageRatio is null (not Infinity/NaN) when goal is zero', () => {
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    const coverage = computeGoalCoverage(null, suggested(0), aggregate, 'central')
    expect(coverage.coverageRatio).toBeNull()
    expect(coverage.deficit).toBe(0)
  })

  it('deficit is negative when the municipality is over-committed relative to its goal', () => {
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    aggregate.effectiveByScenario.central = 1500
    const coverage = computeGoalCoverage(null, suggested(1000), aggregate, 'central')
    expect(coverage.deficit).toBe(-500)
    expect(coverage.coverageRatio).toBeCloseTo(1.5, 6)
  })

  it('reads each scenario independently (mirrors staffVoteTotalByScenario)', () => {
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    aggregate.effectiveByScenario.pessimistic = 100
    aggregate.effectiveByScenario.central = 200
    aggregate.effectiveByScenario.optimistic = 300

    const byScenario = computeGoalCoverageByScenario(
      { pessimistic: 500, optimistic: 900 },
      // Suggested fallback used only for 'central' here (unset in expectedVotes).
      suggested(600, { pessimistic: 540, optimistic: 700 }),
      aggregate,
    )

    expect(byScenario.pessimistic.goal).toBe(500)
    expect(byScenario.pessimistic.committed).toBe(100)
    expect(byScenario.central.goal).toBe(600) // falls back to suggestedGoal
    expect(byScenario.central.committed).toBe(200)
    expect(byScenario.optimistic.goal).toBe(900)
    expect(byScenario.optimistic.committed).toBe(300)
  })

  it('the suggested fallback moves with the scenario (E9: both sides are per-scenario)', () => {
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    const byScenario = computeGoalCoverageByScenario(
      null,
      suggested(1000, { pessimistic: 900, optimistic: 1163 }),
      aggregate,
    )

    expect(byScenario.pessimistic.goal).toBe(900)
    expect(byScenario.central.goal).toBe(1000)
    expect(byScenario.optimistic.goal).toBe(1163)
  })
})

describe('goal coverage labels', () => {
  it('renders a fractional decomposed goal as whole votes', () => {
    // A suggested goal of 100.968 votes must not read as "100,968" in pt-BR.
    const aggregate = createEmptyMunicipalityPledgeAggregate()
    const coverage = computeGoalCoverage(null, suggested(100.968), aggregate, 'central')
    expect(formatGoalCoverageDeficitLabel(coverage)).toBe('Faltam 101 votos para a meta')
  })
})

describe('aggregateGoalCoverage', () => {
  it('sums goal and committed across municipalities and recomputes the ratio', () => {
    const aggregate = aggregateGoalCoverage([
      { goal: 3000, committed: 1200, coverageRatio: 0.4, deficit: 1800 },
      { goal: 1000, committed: 1000, coverageRatio: 1, deficit: 0 },
    ])
    expect(aggregate.goal).toBe(4000)
    expect(aggregate.committed).toBe(2200)
    expect(aggregate.coverageRatio).toBeCloseTo(0.55, 6)
    expect(aggregate.deficit).toBe(1800)
  })

  it('returns coverageRatio null for an empty list (zero goal)', () => {
    expect(aggregateGoalCoverage([]).coverageRatio).toBeNull()
  })
})
