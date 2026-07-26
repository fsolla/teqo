import { describe, expect, it } from 'vitest'

import { nextAdvisorIdsAfterMembership } from '@/lib/municipalityAdvisorMembership'
import { MAX_ADVISORS_PER_MUNICIPALITY } from '@/lib/schemas/municipality'

describe('nextAdvisorIdsAfterMembership', () => {
  it('adds an advisor not yet present', () => {
    expect(nextAdvisorIdsAfterMembership([1, 2], 3, true)).toEqual([1, 2, 3])
  })

  it('removes an advisor present in the list', () => {
    expect(nextAdvisorIdsAfterMembership([1, 2, 3], 2, false)).toEqual([1, 3])
  })

  it('is a no-op (returns null) when already in the desired state', () => {
    expect(nextAdvisorIdsAfterMembership([1, 2], 2, true)).toBeNull()
    expect(nextAdvisorIdsAfterMembership([1, 2], 3, false)).toBeNull()
  })

  it('throws once the municipality is at the advisor cap', () => {
    const atCap = Array.from({ length: MAX_ADVISORS_PER_MUNICIPALITY }, (_, index) => index + 1)
    expect(() => nextAdvisorIdsAfterMembership(atCap, 999, true)).toThrow(
      `Cada município aceita no máximo ${MAX_ADVISORS_PER_MUNICIPALITY} assessores.`,
    )
  })
})
