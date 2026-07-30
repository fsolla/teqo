import { describe, expect, it } from 'vitest'

import {
  compareHomeSearchNameRelevance,
  homeSearchNameRelevanceTier,
} from '@/lib/homeSearchMunicipalityMatch'

describe('homeSearchMunicipalityMatch', () => {
  it('ranks prefix match before word-start later in the label', () => {
    expect(homeSearchNameRelevanceTier('cairu', 'cai')).toBe(0)
    expect(homeSearchNameRelevanceTier('porto seguro', 'seg')).toBe(1)
  })

  it('sorts by relevance tier then tie-break desc', () => {
    const normalizedQuery = 'cai'
    const hits = [
      { normalizedName: 'porto seguro', tieBreakDesc: 9000 },
      { normalizedName: 'cairu', tieBreakDesc: 100 },
      { normalizedName: 'caicara', tieBreakDesc: 5000 },
    ]
    const sorted = [...hits].sort((a, b) => compareHomeSearchNameRelevance(a, b, normalizedQuery))
    expect(sorted.map((row) => row.normalizedName)).toEqual(['caicara', 'cairu', 'porto seguro'])
  })
})
