import { describe, expect, it } from 'vitest'

import { municipalitySignalTypeMeta } from '@/lib/municipalitySignalTypeMeta'
import { municipalitySignalTypes } from '@/lib/schemas/municipalityUpdate'
import { shouldShowWizardSignalSkip } from '@/lib/wizardSignalUi'

describe('wizardSignalUi', () => {
  it('hides skip for standalone register-signal entry', () => {
    expect(shouldShowWizardSignalSkip(undefined)).toBe(false)
    expect(shouldShowWizardSignalSkip('register-signal')).toBe(false)
  })

  it('shows skip when embedded from another wizard action', () => {
    expect(shouldShowWizardSignalSkip('update-votes')).toBe(true)
    expect(shouldShowWizardSignalSkip('change-trend')).toBe(true)
  })
})

describe('municipalitySignalTypeMeta', () => {
  it('covers every signal type with icon and info copy', () => {
    expect(municipalitySignalTypeMeta).toHaveLength(municipalitySignalTypes.length)

    for (const type of municipalitySignalTypes) {
      const entry = municipalitySignalTypeMeta.find((item) => item.type === type)
      expect(entry?.label.length).toBeGreaterThan(0)
      expect(entry?.shortDescription.length).toBeGreaterThan(0)
      expect(entry?.infoContent.length).toBeGreaterThan(20)
      expect(entry?.icon).toBeTruthy()
    }
  })
})
