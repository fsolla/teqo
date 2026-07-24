import { describe, expect, it } from 'vitest'

import { municipalityStrategyUpdateSchema } from '@/lib/schemas/municipality'
import {
  aggregateVoteGoals,
  countHighPriorityEntries,
  getVoteGoalsOrderViolation,
  sumVoteGoals,
  voteGoalProgressPercent,
} from '@/utilities/voteGoals'

describe('vote goals schema and aggregates', () => {
  it('accepts vote goals and priority on the municipality strategy schema', () => {
    const parsed = municipalityStrategyUpdateSchema.parse({
      municipality: 1,
      voteGoals: { good: 1000, regular: 800, minimum: 500 },
      priority: 'alta',
    })

    expect(parsed.voteGoals).toEqual({ good: 1000, regular: 800, minimum: 500 })
    expect(parsed.priority).toBe('alta')
  })

  it('aggregates vote goals and counts high-priority municipalities', () => {
    const municipalities = [
      {
        voteGoals: { good: 1000, regular: 800, minimum: 500 },
        priority: 'alta' as const,
      },
      {
        voteGoals: { good: 200, regular: 150, minimum: 100 },
        priority: 'normal' as const,
      },
    ]

    expect(aggregateVoteGoals(municipalities)).toEqual({
      good: 1200,
      regular: 950,
      minimum: 600,
      highPriorityCount: 1,
    })
    expect(sumVoteGoals(municipalities)).toEqual({ good: 1200, regular: 950, minimum: 600 })
    expect(countHighPriorityEntries(municipalities)).toBe(1)
    expect(voteGoalProgressPercent(400, 800)).toBe(50)
    expect(voteGoalProgressPercent(null, 800)).toBeNull()
  })

  it('flags vote goal order violations on sparse inputs', () => {
    expect(getVoteGoalsOrderViolation({ good: 100, regular: 200 })).toBe('regular')
    expect(getVoteGoalsOrderViolation({ regular: 50, minimum: 100 })).toBe('minimum')
    expect(getVoteGoalsOrderViolation({ good: 100, minimum: 200 })).toBe('minimum')
    expect(getVoteGoalsOrderViolation({ good: 100, regular: 80 })).toBeNull()
  })
})
