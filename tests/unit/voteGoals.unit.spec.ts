import { describe, expect, it } from 'vitest'

import { plazaStrategyUpdateSchema } from '@/lib/schemas/plaza'
import {
  aggregateVoteGoals,
  countHighPriorityEntries,
  getVoteGoalsOrderViolation,
  sumVoteGoals,
  voteGoalProgressPercent,
} from '@/utilities/voteGoals'

describe('vote goals schema and aggregates', () => {
  it('accepts vote goals and priority on the plaza strategy schema', () => {
    const parsed = plazaStrategyUpdateSchema.parse({
      plaza: 1,
      voteGoals: { good: 1000, regular: 800, minimum: 500 },
      priority: 'alta',
    })

    expect(parsed.voteGoals).toEqual({ good: 1000, regular: 800, minimum: 500 })
    expect(parsed.priority).toBe('alta')
  })

  it('aggregates vote goals and counts high-priority plazas', () => {
    const plazas = [
      {
        voteGoals: { good: 1000, regular: 800, minimum: 500 },
        priority: 'alta' as const,
      },
      {
        voteGoals: { good: 200, regular: 150, minimum: 100 },
        priority: 'normal' as const,
      },
    ]

    expect(aggregateVoteGoals(plazas)).toEqual({
      good: 1200,
      regular: 950,
      minimum: 600,
      highPriorityCount: 1,
    })
    expect(sumVoteGoals(plazas)).toEqual({ good: 1200, regular: 950, minimum: 600 })
    expect(countHighPriorityEntries(plazas)).toBe(1)
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
