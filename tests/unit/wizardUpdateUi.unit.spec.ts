import { describe, expect, it } from 'vitest'

import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import { WIZARD_CHAIN_SKIP_LABEL } from '@/lib/campaignWizardCopy'
import { resolveWizardUpdateSkip, shouldShowWizardUpdateSkip } from '@/lib/wizardUpdateUi'

describe('wizardUpdateUi', () => {
  it('hides skip for standalone register-update entry', () => {
    expect(shouldShowWizardUpdateSkip(undefined)).toBe(false)
    expect(shouldShowWizardUpdateSkip('register-update')).toBe(false)
    expect(resolveWizardUpdateSkip(undefined, 'cairu')).toBeUndefined()
    expect(resolveWizardUpdateSkip('register-update', 'cairu')).toBeUndefined()
  })

  it('shows skip to the next chain step when embedded from another wizard', () => {
    expect(shouldShowWizardUpdateSkip('update-votes')).toBe(true)
    expect(shouldShowWizardUpdateSkip('change-trend')).toBe(true)
    expect(resolveWizardUpdateSkip('update-votes', 'cairu')).toEqual({
      label: WIZARD_CHAIN_SKIP_LABEL,
      href: `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&entry=update-votes`,
    })
    expect(resolveWizardUpdateSkip('change-trend', 'cairu')).toEqual({
      label: WIZARD_CHAIN_SKIP_LABEL,
      href: `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos?municipio=cairu&entry=change-trend`,
    })
  })
})
