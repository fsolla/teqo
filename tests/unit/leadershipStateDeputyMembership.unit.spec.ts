import { describe, expect, it } from 'vitest'

import { nextStateDeputyIdsAfterMembership } from '@/lib/leadershipStateDeputyMembership'
import { MAX_LEADERSHIP_STATE_DEPUTIES } from '@/lib/schemas/leadership'

describe('nextStateDeputyIdsAfterMembership', () => {
  it('adds a state deputy not yet present', () => {
    expect(nextStateDeputyIdsAfterMembership([1, 2], 3, true)).toEqual([1, 2, 3])
  })

  it('removes a state deputy present in the list', () => {
    expect(nextStateDeputyIdsAfterMembership([1, 2, 3], 2, false)).toEqual([1, 3])
  })

  it('is a no-op (returns null) when already in the desired state', () => {
    expect(nextStateDeputyIdsAfterMembership([1, 2], 2, true)).toBeNull()
    expect(nextStateDeputyIdsAfterMembership([1, 2], 3, false)).toBeNull()
  })

  it('throws once the leadership is at the state-deputy cap', () => {
    const atCap = Array.from({ length: MAX_LEADERSHIP_STATE_DEPUTIES }, (_, index) => index + 1)
    expect(() => nextStateDeputyIdsAfterMembership(atCap, 999, true)).toThrow(
      `Cada liderança aceita no máximo ${MAX_LEADERSHIP_STATE_DEPUTIES} dobradinhas.`,
    )
  })
})
