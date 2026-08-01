import { describe, expect, it } from 'vitest'

import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  isWizardChainActionId,
  nextWizardChainStep,
  resolveWizardChainEntry,
  wizardChainAfter,
  wizardChainContinueHref,
} from '@/lib/wizardActionChain'

describe('wizardActionChain', () => {
  it('excludes register-demand from the chainable set', () => {
    expect(isWizardChainActionId('update-votes')).toBe(true)
    expect(isWizardChainActionId('register-demand')).toBe(false)
    expect(isWizardChainActionId(undefined)).toBe(false)
  })

  it('returns the full queue after the principal action', () => {
    expect(wizardChainAfter('update-votes')).toEqual([
      'change-trend',
      'register-signal',
      'update-leadership',
    ])
    expect(wizardChainAfter('update-votes', 'update-votes')).toEqual([
      'change-trend',
      'register-signal',
      'update-leadership',
    ])
    expect(wizardChainAfter('register-signal', 'register-signal')).toEqual([
      'change-trend',
      'update-votes',
      'update-leadership',
    ])
    expect(wizardChainAfter('change-trend', 'change-trend')).toEqual([
      'register-signal',
      'update-votes',
      'update-leadership',
    ])
    expect(wizardChainAfter('update-leadership', 'update-leadership')).toEqual([
      'register-signal',
      'update-votes',
      'change-trend',
    ])
  })

  it('slices the remaining queue after a chained step', () => {
    expect(wizardChainAfter('update-votes', 'change-trend')).toEqual([
      'register-signal',
      'update-leadership',
    ])
    expect(wizardChainAfter('update-votes', 'register-signal')).toEqual(['update-leadership'])
    expect(wizardChainAfter('update-votes', 'update-leadership')).toEqual([])
    expect(nextWizardChainStep('change-trend', 'register-signal')).toBe('update-votes')
    expect(nextWizardChainStep('update-leadership', 'change-trend')).toBeUndefined()
  })

  it('builds continue hrefs with entry + municipio, or Início at the end', () => {
    expect(wizardChainContinueHref('update-votes', 'update-votes', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/mudar-tendencia?municipio=cairu&entry=update-votes`,
    )
    expect(wizardChainContinueHref('update-votes', 'change-trend', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/registrar-sinal?municipio=cairu&entry=update-votes`,
    )
    expect(wizardChainContinueHref('register-signal', 'change-trend', 'cairu')).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos?municipio=cairu&entry=register-signal`,
    )
    expect(wizardChainContinueHref('change-trend', 'update-leadership', 'cairu')).toBe(
      CAMPAIGN_HOME,
    )
    expect(wizardChainContinueHref('register-demand', 'update-votes', 'cairu')).toBe(CAMPAIGN_HOME)
  })

  it('resolves session entry from query or current principal', () => {
    expect(resolveWizardChainEntry(undefined, 'update-votes')).toBe('update-votes')
    expect(resolveWizardChainEntry('register-signal', 'update-votes')).toBe('register-signal')
    expect(resolveWizardChainEntry('register-demand', 'change-trend')).toBe('change-trend')
  })
})
