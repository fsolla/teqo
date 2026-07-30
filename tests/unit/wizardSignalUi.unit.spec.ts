import { describe, expect, it } from 'vitest'

import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
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
    expect(resolveWizardSignalSkip(undefined)).toBeUndefined()
    expect(resolveWizardSignalSkip('register-signal')).toBeUndefined()
  })

  it('shows skip when embedded from another wizard action', () => {
    expect(shouldShowWizardSignalSkip('update-votes')).toBe(true)
    expect(shouldShowWizardSignalSkip('change-trend')).toBe(true)
    expect(resolveWizardSignalSkip('update-votes')).toEqual({
      label: WIZARD_SIGNAL_SKIP_LABEL,
      href: CAMPAIGN_HOME,
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
