import { describe, expect, it } from 'vitest'

import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import {
  applyVoteShortcut,
  getWizardVoteViolation,
  getWizardVoteViolationHighlights,
  parseWizardVoteDraft,
} from '@/lib/wizardVoteEstimate'

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

describe('parseWizardVoteDraft', () => {
  it('parses digits and empty as null', () => {
    expect(parseWizardVoteDraft('')).toBeNull()
    expect(parseWizardVoteDraft('  1.200  ')).toBe(1200)
    expect(parseWizardVoteDraft('abc')).toBeNull()
  })
})

describe('getWizardVoteViolation', () => {
  it('returns null for ordered triples', () => {
    expect(getWizardVoteViolation({ pessimistic: 100, central: 200, optimistic: 300 })).toBeNull()
  })

  it('flags pessimista above média with readable message', () => {
    const violation = getWizardVoteViolation({ pessimistic: 300, central: 200, optimistic: 400 })
    expect(violation?.violatingScenario).toBe('central')
    expect(violation?.message).toContain('Pessimista')
    expect(violation?.message).toContain('média')
  })

  it('flags otimista below média', () => {
    const violation = getWizardVoteViolation({ pessimistic: 100, central: 500, optimistic: 400 })
    expect(violation?.violatingScenario).toBe('optimistic')
    expect(violation?.message).toContain('Otimista')
  })
})

describe('getWizardVoteViolationHighlights', () => {
  it('highlights pessimista and média when pessimista is above média', () => {
    expect(
      getWizardVoteViolationHighlights({ pessimistic: 300, central: 200, optimistic: 400 }),
    ).toEqual(['pessimistic', 'central'])
  })

  it('highlights otimista and média when otimista is below média', () => {
    expect(
      getWizardVoteViolationHighlights({ pessimistic: 100, central: 500, optimistic: 400 }),
    ).toEqual(['optimistic', 'central'])
  })

  it('returns empty when estimates are ordered', () => {
    expect(
      getWizardVoteViolationHighlights({ pessimistic: 100, central: 200, optimistic: 300 }),
    ).toEqual([])
  })
})
