import { describe, expect, it } from 'vitest'

import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import {
  municipalitySignalTypeMeta,
  municipalitySignalTypeMetaByType,
} from '@/lib/municipalitySignalTypeMeta'
import { municipalitySignalTypes } from '@/lib/schemas/municipalityUpdate'
import {
  resolveWizardSignalSkip,
  shouldShowWizardSignalSkip,
  WIZARD_SIGNAL_SKIP_LABEL,
} from '@/lib/wizardSignalUi'

describe('wizardSignalUi', () => {
  it('hides skip for standalone register-signal entry', () => {
    expect(shouldShowWizardSignalSkip(undefined)).toBe(false)
    expect(shouldShowWizardSignalSkip('register-signal')).toBe(false)
    expect(resolveWizardSignalSkip(undefined, 'cairu')).toBeUndefined()
    expect(resolveWizardSignalSkip('register-signal', 'cairu')).toBeUndefined()
  })

  it('shows skip to the next chain step when embedded from another wizard', () => {
    expect(shouldShowWizardSignalSkip('update-votes')).toBe(true)
    expect(shouldShowWizardSignalSkip('change-trend')).toBe(true)
    expect(resolveWizardSignalSkip('update-votes', 'cairu')).toEqual({
      label: WIZARD_SIGNAL_SKIP_LABEL,
      href: `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&entry=update-votes`,
    })
    expect(resolveWizardSignalSkip('change-trend', 'cairu')).toEqual({
      label: WIZARD_SIGNAL_SKIP_LABEL,
      href: `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos?municipio=cairu&entry=change-trend`,
    })
  })
})

describe('municipalitySignalTypeMeta', () => {
  it('covers every signal type with icon and info copy', () => {
    expect(municipalitySignalTypeMeta).toHaveLength(municipalitySignalTypes.length)

    for (const type of municipalitySignalTypes) {
      const entry = municipalitySignalTypeMetaByType[type]
      expect(entry?.label.length).toBeGreaterThan(0)
      expect(entry?.shortDescription.length).toBeGreaterThan(0)
      expect(entry?.infoContent.length).toBeGreaterThan(20)
      expect(entry?.icon).toBeTruthy()
    }
  })
})
