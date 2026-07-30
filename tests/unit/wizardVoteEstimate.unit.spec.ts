import { describe, expect, it } from 'vitest'

import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import {
  applyVoteShortcut,
  getNextWizardVoteScenario,
  getPreviousWizardVoteScenario,
  getWizardVoteViolation,
  mergeWizardVoteEstimate,
  parseWizardVoteDraft,
  WIZARD_VOTE_SCENARIO_EDIT_ORDER,
  wizardVoteStepCtaLabel,
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

describe('wizard scenario navigation', () => {
  it('walks média → pessimista → otimista', () => {
    expect(WIZARD_VOTE_SCENARIO_EDIT_ORDER).toEqual(['central', 'pessimistic', 'optimistic'])
    expect(getNextWizardVoteScenario('central')).toBe('pessimistic')
    expect(getNextWizardVoteScenario('pessimistic')).toBe('optimistic')
    expect(getNextWizardVoteScenario('optimistic')).toBeNull()
    expect(getPreviousWizardVoteScenario('pessimistic')).toBe('central')
    expect(getPreviousWizardVoteScenario('central')).toBeNull()
  })

  it('labels CTA per scenario', () => {
    expect(wizardVoteStepCtaLabel('central')).toBe('Ajustar estimativa média →')
    expect(wizardVoteStepCtaLabel('pessimistic')).toBe('Ajustar estimativa pessimista →')
    expect(wizardVoteStepCtaLabel('optimistic')).toBe('Ajustar estimativa otimista →')
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

describe('mergeWizardVoteEstimate', () => {
  it('updates one scenario while keeping the rest', () => {
    expect(
      mergeWizardVoteEstimate({ pessimistic: 100, central: 200, optimistic: 300 }, 'central', 250),
    ).toEqual({ pessimistic: 100, central: 250, optimistic: 300 })
  })
})
