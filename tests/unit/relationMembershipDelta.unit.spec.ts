import { describe, expect, it } from 'vitest'

import { nextStateDeputyIdsAfterMembership } from '@/lib/leadershipStateDeputyMembership'
import { nextAdvisorIdsAfterMembership } from '@/lib/municipalityAdvisorMembership'
import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import {
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  MAX_LEADERSHIP_STATE_DEPUTIES,
} from '@/lib/schemas/leadership'
import {
  MAX_ADVISORS_PER_MUNICIPALITY,
  MAX_STATE_DEPUTIES_PER_MUNICIPALITY,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/municipality'

/**
 * One contract, three relations. Each wrapper only binds its own cap to
 * `nextIdsAfterMembership`, so the delta behaviour is pinned once and each
 * wrapper is additionally pinned to refuse at ITS cap with ITS message — the
 * pair `safeMessages` matches by exact string.
 */
const relations = [
  {
    name: 'nextAdvisorIdsAfterMembership (municipality.advisors)',
    next: nextAdvisorIdsAfterMembership,
    max: MAX_ADVISORS_PER_MUNICIPALITY,
    capMessage: MUNICIPALITY_ADVISORS_CAP_MESSAGE,
  },
  {
    name: 'nextStateDeputyIdsAfterMembership (leadership.stateDeputies)',
    next: nextStateDeputyIdsAfterMembership,
    max: MAX_LEADERSHIP_STATE_DEPUTIES,
    capMessage: LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  },
  {
    name: 'nextStateDeputyIdsAfterMunicipalityMembership (municipality.stateDeputies)',
    next: nextStateDeputyIdsAfterMunicipalityMembership,
    max: MAX_STATE_DEPUTIES_PER_MUNICIPALITY,
    capMessage: MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
  },
] as const

describe.each(relations)('$name', ({ next, max, capMessage }) => {
  it('adds an id not yet present', () => {
    expect(next([1, 2], 3, true)).toEqual([1, 2, 3])
  })

  it('removes an id present in the list', () => {
    expect(next([1, 2, 3], 2, false)).toEqual([1, 3])
  })

  it('is a no-op (returns null) when already in the desired state', () => {
    expect(next([1, 2], 2, true)).toBeNull()
    expect(next([1, 2], 3, false)).toBeNull()
  })

  it('can go to zero', () => {
    expect(next([1], 1, false)).toEqual([])
  })

  it('does not mutate the list it was given', () => {
    const current = [1, 2]
    next(current, 3, true)
    next(current, 2, false)
    expect(current).toEqual([1, 2])
  })

  it('throws its own cap message once at its own cap', () => {
    const atCap = Array.from({ length: max }, (_, index) => index + 1)
    expect(() => next(atCap, max + 1, true)).toThrow(capMessage)
    // At the cap, a removal is still allowed — the ceiling is not a freeze.
    expect(next(atCap, 1, false)).toHaveLength(max - 1)
  })
})
