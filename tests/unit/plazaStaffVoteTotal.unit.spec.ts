import { describe, expect, it } from 'vitest'

import {
  createEmptyPlazaPledgeAggregate,
  resolvePlazaStaffVoteTotal,
  rollupPlazaStaffVotes,
} from '@/utilities/votePledgeData'

describe('resolvePlazaStaffVoteTotal', () => {
  it('falls back to pledge effective total when expectedVotes central is null', () => {
    expect(resolvePlazaStaffVoteTotal(null, 420)).toBe(420)
  })

  it('uses expectedVotes central when set, ignoring pledge aggregate', () => {
    expect(resolvePlazaStaffVoteTotal({ central: 1500 }, 420)).toBe(1500)
  })

  it('returns zero when both expectedVotes and pledges are empty', () => {
    expect(resolvePlazaStaffVoteTotal(null, 0)).toBe(0)
  })
})

describe('rollupPlazaStaffVotes', () => {
  it('sums per-plaza staff totals and pledge metadata', () => {
    const aggregates = new Map([
      [
        1,
        {
          ...createEmptyPlazaPledgeAggregate(),
          effectiveByScenario: { pessimistic: 80, central: 100, optimistic: 120 },
          declaredTotal: 80,
          pledgeCount: 2,
          missingEstimateCount: 1,
        },
      ],
      [
        2,
        {
          ...createEmptyPlazaPledgeAggregate(),
          effectiveByScenario: { pessimistic: 40, central: 50, optimistic: 60 },
          declaredTotal: 50,
          pledgeCount: 1,
          missingEstimateCount: 0,
        },
      ],
    ])
    expect(
      rollupPlazaStaffVotes(
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
