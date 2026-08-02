import { describe, expect, it } from 'vitest'

import { declaredVotesByLeadershipFromPledges } from '@/lib/wizardLeadershipContract'

describe('declaredVotesByLeadershipFromPledges', () => {
  it('maps leadership id to declared votes', () => {
    const map = declaredVotesByLeadershipFromPledges([
      { leadership: 7, declaredVotes: 120 },
      { leadership: { id: 9 }, declaredVotes: 45 },
    ])

    expect(map.get(7)).toBe(120)
    expect(map.get(9)).toBe(45)
    expect(map.get(99)).toBeUndefined()
  })

  it('treats null declaredVotes as zero', () => {
    const map = declaredVotesByLeadershipFromPledges([{ leadership: 3, declaredVotes: null }])

    expect(map.get(3)).toBe(0)
  })

  it('last pledge wins when duplicate leadership ids appear', () => {
    const map = declaredVotesByLeadershipFromPledges([
      { leadership: 5, declaredVotes: 10 },
      { leadership: 5, declaredVotes: 20 },
    ])

    expect(map.get(5)).toBe(20)
  })
})
