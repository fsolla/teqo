import { describe, expect, it } from 'vitest'

import { nextStateDeputyIdsAfterMunicipalityMembership } from '@/lib/municipalityStateDeputyMembership'
import { MAX_STATE_DEPUTIES_PER_MUNICIPALITY } from '@/lib/schemas/municipality'

describe('nextStateDeputyIdsAfterMunicipalityMembership', () => {
  it('adds a state deputy not yet present', () => {
    expect(nextStateDeputyIdsAfterMunicipalityMembership([1, 2], 3, true)).toEqual([1, 2, 3])
  })

  it('removes a state deputy present in the list', () => {
    expect(nextStateDeputyIdsAfterMunicipalityMembership([1, 2, 3], 2, false)).toEqual([1, 3])
  })

  it('is a no-op (returns null) when already in the desired state', () => {
    expect(nextStateDeputyIdsAfterMunicipalityMembership([1, 2], 2, true)).toBeNull()
    expect(nextStateDeputyIdsAfterMunicipalityMembership([1, 2], 3, false)).toBeNull()
  })

  it('can go to zero', () => {
    expect(nextStateDeputyIdsAfterMunicipalityMembership([1], 1, false)).toEqual([])
  })

  it('throws once the municipality is at the state-deputy cap', () => {
    const atCap = Array.from(
      { length: MAX_STATE_DEPUTIES_PER_MUNICIPALITY },
      (_, index) => index + 1,
    )
    expect(() => nextStateDeputyIdsAfterMunicipalityMembership(atCap, 999, true)).toThrow(
      `Cada município aceita no máximo ${MAX_STATE_DEPUTIES_PER_MUNICIPALITY} dobradinhas.`,
    )
  })
})
