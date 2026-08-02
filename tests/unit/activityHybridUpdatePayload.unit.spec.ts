import { describe, expect, it } from 'vitest'

import { activityUpdateSchema } from '@/lib/schemas/activity'

/**
 * Pass 5 P1a — hybrid activity updates must be able to clear relations with
 * explicit null (omitting the key leaves the previous server value).
 */
describe('activity hybrid update payload (Pass 5 P1a)', () => {
  it('accepts null responsible and leadership on patch', () => {
    const parsed = activityUpdateSchema.parse({
      id: 1,
      responsible: null,
      leadership: null,
      description: null,
      locality: null,
    })
    expect(parsed.responsible).toBeNull()
    expect(parsed.leadership).toBeNull()
  })

  it('rejects omitting id', () => {
    expect(() => activityUpdateSchema.parse({ responsible: null })).toThrow()
  })
})
