import { describe, expect, it } from 'vitest'

import { showLeadershipWizardSkip } from '@/lib/wizardLeadershipContract'

describe('showLeadershipWizardSkip', () => {
  it('hides skip for standalone entry (implicit update-leadership)', () => {
    expect(showLeadershipWizardSkip(undefined)).toBe(false)
  })

  it('hides skip when entry is update-leadership', () => {
    expect(showLeadershipWizardSkip('update-leadership')).toBe(false)
  })

  it('shows skip when embedded from another wizard action', () => {
    expect(showLeadershipWizardSkip('update-votes')).toBe(true)
  })
})
