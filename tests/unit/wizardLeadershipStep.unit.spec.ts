import { describe, expect, it } from 'vitest'

import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import { WIZARD_CHAIN_SKIP_LABEL } from '@/lib/campaignWizardCopy'
import {
  resolveWizardLeadershipSkip,
  showLeadershipWizardSkip,
} from '@/lib/wizardLeadershipContract'

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

describe('resolveWizardLeadershipSkip', () => {
  it('returns undefined for standalone entry', () => {
    expect(resolveWizardLeadershipSkip(undefined, 'cairu')).toBeUndefined()
    expect(resolveWizardLeadershipSkip('update-leadership', 'cairu')).toBeUndefined()
  })

  it('points skip to Início when leadership is the last chained step', () => {
    // In the v1 matrix, leadership is always the final chained elo.
    expect(resolveWizardLeadershipSkip('update-votes', 'cairu')).toEqual({
      label: WIZARD_CHAIN_SKIP_LABEL,
      href: CAMPAIGN_HOME,
    })
  })
})
