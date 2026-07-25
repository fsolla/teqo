import { describe, expect, it } from 'vitest'

import {
  effectivePledgeVotesForScenario,
  formatVoteEstimateEndpointsLabel,
  getVoteEstimateOrderViolation,
  normalizeVoteEstimateOnSave,
  resolveMunicipalityStaffVoteTotalForScenario,
} from '@/lib/voteEstimate'
import { createEmptyMunicipalityPledgeAggregate, resolveMunicipalityStaffVoteTotal, rollupMunicipalityStaffVotes } from '@/utilities/votePledgeViews'

describe('getVoteEstimateOrderViolation', () => {
  it('returns null when pessimistic ≤ central ≤ optimistic', () => {
    expect(
      getVoteEstimateOrderViolation({ pessimistic: 100, central: 200, optimistic: 300 }),
    ).toBeNull()
  })

  it('flags central when it breaks order', () => {
    expect(getVoteEstimateOrderViolation({ pessimistic: 300, central: 100 })).toBe('central')
  })
})

describe('normalizeVoteEstimateOnSave', () => {
  it('raises central when pessimistic exceeds it', () => {
    expect(
      normalizeVoteEstimateOnSave({ pessimistic: 800, central: 700, optimistic: 900 }),
    ).toEqual({ pessimistic: 800, central: 800, optimistic: 900 })
  })

  it('lowers central when optimistic is below it', () => {
    expect(
      normalizeVoteEstimateOnSave({ pessimistic: 500, central: 700, optimistic: 600 }),
    ).toEqual({ pessimistic: 500, central: 600, optimistic: 600 })
  })

  it('leaves ordered values unchanged', () => {
    expect(
      normalizeVoteEstimateOnSave({ pessimistic: 100, central: 200, optimistic: 300 }),
    ).toEqual({ pessimistic: 100, central: 200, optimistic: 300 })
  })
})

describe('effectivePledgeVotesForScenario', () => {
  it('uses declared when scenario estimate is missing', () => {
    expect(effectivePledgeVotesForScenario(50, { central: null }, 'central')).toBe(50)
  })

  it('uses scenario estimate when present', () => {
    expect(
      effectivePledgeVotesForScenario(
        50,
        { pessimistic: 30, central: 40, optimistic: 60 },
        'pessimistic',
      ),
    ).toBe(30)
  })
})

describe('resolveMunicipalityStaffVoteTotal', () => {
  it('falls back to pledge effective total when expected central is null', () => {
    expect(resolveMunicipalityStaffVoteTotal(null, 420)).toBe(420)
  })

  it('uses expected central when set', () => {
    expect(resolveMunicipalityStaffVoteTotal({ central: 1500 }, 420)).toBe(1500)
  })

  it('resolves per scenario independently', () => {
    expect(
      resolveMunicipalityStaffVoteTotalForScenario(
        { pessimistic: 100, central: 200, optimistic: 300 },
        420,
        'optimistic',
      ),
    ).toBe(300)
  })
})

describe('rollupMunicipalityStaffVotes', () => {
  it('sums per-municipality staff totals and pledge metadata', () => {
    const aggregates = new Map([
      [
        1,
        {
          ...createEmptyMunicipalityPledgeAggregate(),
          effectiveByScenario: { pessimistic: 80, central: 100, optimistic: 120 },
          declaredTotal: 80,
          pledgeCount: 2,
          missingEstimateCount: 1,
        },
      ],
      [
        2,
        {
          ...createEmptyMunicipalityPledgeAggregate(),
          effectiveByScenario: { pessimistic: 40, central: 50, optimistic: 60 },
          declaredTotal: 50,
          pledgeCount: 1,
          missingEstimateCount: 0,
        },
      ],
    ])
    expect(
      rollupMunicipalityStaffVotes(
        [
          { id: 1, expectedVotes: null },
          { id: 2, expectedVotes: { central: 200 } },
        ],
        aggregates,
      ),
    ).toEqual({
      staffVoteTotal: 300,
      staffVoteTotalByScenario: { pessimistic: 120, central: 300, optimistic: 180 },
      declaredVotesTotal: 130,
      pledgeCount: 3,
      missingEstimateCount: 1,
    })
  })
})

describe('formatVoteEstimateEndpointsLabel', () => {
  it('labels pessimista and otimista endpoints', () => {
    expect(
      formatVoteEstimateEndpointsLabel({
        pessimistic: 1200,
        central: 1500,
        optimistic: 1800,
      }),
    ).toBe('Pessimista 1.200 · Otimista 1.800')
  })

  it('returns null when an endpoint is missing', () => {
    expect(
      formatVoteEstimateEndpointsLabel({
        pessimistic: 1200,
        central: 1500,
        optimistic: null,
      }),
    ).toBeNull()
  })
})
