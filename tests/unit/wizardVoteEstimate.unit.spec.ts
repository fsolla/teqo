import { describe, expect, it } from 'vitest'

import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import { applyVoteShortcut, getWizardVoteViolation } from '@/lib/wizardVoteEstimate'

describe('applyVoteShortcut', () => {
  it('doubles the current value', () => {
    expect(applyVoteShortcut(150, 'double')).toBe(300)
  })

  it('no-ops double when value is below 1', () => {
    expect(applyVoteShortcut(0, 'double')).toBe(0)
    expect(applyVoteShortcut(null, 'double')).toBe(0)
  })

  it('clamps at MAX_VOTE_COUNT', () => {
    expect(applyVoteShortcut(MAX_VOTE_COUNT - 10, '+50')).toBe(MAX_VOTE_COUNT)
    expect(applyVoteShortcut(MAX_VOTE_COUNT, 'double')).toBe(MAX_VOTE_COUNT)
  })

  it('applies arithmetic shortcuts and floors at zero', () => {
    expect(applyVoteShortcut(200, '+50')).toBe(250)
    expect(applyVoteShortcut(200, '-50')).toBe(150)
    expect(applyVoteShortcut(200, '+100')).toBe(300)
    expect(applyVoteShortcut(40, '-100')).toBe(0)
  })
})

describe('getWizardVoteViolation', () => {
  it('returns null for ordered triples', () => {
    expect(getWizardVoteViolation({ pessimistic: 100, central: 200, optimistic: 300 })).toBeNull()
  })

  it('flags pessimista above média with readable message and highlights', () => {
    const violation = getWizardVoteViolation({ pessimistic: 300, central: 200, optimistic: 400 })
    expect(violation?.violatingScenario).toBe('central')
    expect(violation?.message).toContain('Pessimista')
    expect(violation?.message).toContain('média')
    expect(violation?.highlightScenarios).toEqual(['pessimistic', 'central'])
  })

  it('flags otimista below média with highlights', () => {
    const violation = getWizardVoteViolation({ pessimistic: 100, central: 500, optimistic: 400 })
    expect(violation?.violatingScenario).toBe('optimistic')
    expect(violation?.message).toContain('Otimista')
    expect(violation?.highlightScenarios).toEqual(['optimistic', 'central'])
  })
})
