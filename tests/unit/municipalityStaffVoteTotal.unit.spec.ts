import { describe, expect, it } from 'vitest'

import { createEmptyMunicipalityPledgeAggregate, resolveMunicipalityStaffVoteTotal, rollupMunicipalityStaffVotes } from '@/utilities/votePledgeViews'

describe('resolveMunicipalityStaffVoteTotal', () => {
  it('falls back to pledge effective total when expectedVotes central is null', () => {
    expect(resolveMunicipalityStaffVoteTotal(null, 420)).toBe(420)
  })

  it('uses expectedVotes central when set, ignoring pledge aggregate', () => {
    expect(resolveMunicipalityStaffVoteTotal({ central: 1500 }, 420)).toBe(1500)
  })

  it('returns zero when both expectedVotes and pledges are empty', () => {
    expect(resolveMunicipalityStaffVoteTotal(null, 0)).toBe(0)
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
