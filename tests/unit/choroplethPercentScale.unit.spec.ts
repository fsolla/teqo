import { describe, expect, it } from 'vitest'

import { computeValidVoteShares } from '@/lib/choroplethColorScale'

describe('computeValidVoteShares', () => {
  it('computes share as votes divided by valid votes', () => {
    expect(
      computeValidVoteShares({ '2927408': 500 }, { '2927408': 1000 }),
    ).toEqual({ '2927408': 0.5 })
  })

  it('omits geographies with zero valid votes', () => {
    expect(
      computeValidVoteShares({ '2927408': 500 }, { '2927408': 0 }),
    ).toEqual({})
  })

  it('omits geographies with zero votes', () => {
    expect(
      computeValidVoteShares({ '2927408': 0 }, { '2927408': 1000 }),
    ).toEqual({})
  })

  it('omits geographies missing from valid votes', () => {
    expect(computeValidVoteShares({ '2927408': 500 }, {})).toEqual({})
  })
})
