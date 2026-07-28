import { describe, expect, it } from 'vitest'

import { nextMunicipalityIdsAfterLeadershipMembership } from '@/lib/leadershipMunicipalityMembership'
import { MAX_LEADERSHIP_MUNICIPALITIES } from '@/lib/schemas/leadership'

describe('nextMunicipalityIdsAfterLeadershipMembership', () => {
  it('appends only the municipalities that are not linked yet, and reports them as added', () => {
    expect(nextMunicipalityIdsAfterLeadershipMembership([10, 20], [20, 30, 40], true)).toEqual({
      next: [10, 20, 30, 40],
      added: [30, 40],
      changed: [30, 40],
    })
  })

  it('removes the requested municipalities, ignores the ones not linked, and adds nothing', () => {
    // `changed` excludes 99: it was never linked, so revalidating it would bust a
    // route cache for a município this write did not touch.
    expect(nextMunicipalityIdsAfterLeadershipMembership([10, 20, 30], [20, 99], false)).toEqual({
      next: [10, 30],
      added: [],
      changed: [20],
    })
  })

  it('returns null when the leadership is already in the desired state', () => {
    expect(nextMunicipalityIdsAfterLeadershipMembership([10, 20], [10, 20], true)).toBeNull()
    expect(nextMunicipalityIdsAfterLeadershipMembership([10, 20], [30], false)).toBeNull()
  })

  it('refuses to remove the last municipality', () => {
    expect(() => nextMunicipalityIdsAfterLeadershipMembership([10], [10], false)).toThrow(
      'pelo menos um município',
    )
    expect(() => nextMunicipalityIdsAfterLeadershipMembership([10, 20], [10, 20], false)).toThrow(
      'pelo menos um município',
    )
  })

  it('refuses a batch that would cross the cap', () => {
    const current = Array.from({ length: MAX_LEADERSHIP_MUNICIPALITIES - 1 }, (_, i) => i + 1)

    expect(nextMunicipalityIdsAfterLeadershipMembership(current, [900], true)?.next).toHaveLength(
      MAX_LEADERSHIP_MUNICIPALITIES,
    )
    expect(() => nextMunicipalityIdsAfterLeadershipMembership(current, [900, 901], true)).toThrow(
      `no máximo ${MAX_LEADERSHIP_MUNICIPALITIES}`,
    )
  })
})
