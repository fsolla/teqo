import { describe, expect, it } from 'vitest'

import {
  ADVISOR_EDITING_OPTIONS,
  ADVISOR_VISIBILITY_OPTIONS,
  advisorProfileLabel,
  isAdvisorEditingValue,
  isAdvisorVisibilityValue,
  isCoherentAdvisorProfile,
} from '@/lib/campaignAdvisorProfile'

describe('campaign advisor profile (C141)', () => {
  it('labels the badge the same way the UI draft spells it', () => {
    expect(advisorProfileLabel('carteira', 'carteira')).toBe('Carteira · Edita carteira')
    expect(advisorProfileLabel('tudo', 'somente_leitura')).toBe('Tudo · Somente leitura')
    expect(advisorProfileLabel('tudo', 'tudo')).toBe('Tudo · Edita tudo')
    expect(advisorProfileLabel('carteira', 'somente_leitura')).toBe('Carteira · Somente leitura')
    expect(advisorProfileLabel('tudo', 'carteira')).toBe('Tudo · Edita carteira')
  })

  it('rejects the incoherent combination (editing more than one sees)', () => {
    expect(isCoherentAdvisorProfile('tudo', 'tudo')).toBe(true)
    expect(isCoherentAdvisorProfile('tudo', 'carteira')).toBe(true)
    expect(isCoherentAdvisorProfile('tudo', 'somente_leitura')).toBe(true)
    expect(isCoherentAdvisorProfile('carteira', 'carteira')).toBe(true)
    expect(isCoherentAdvisorProfile('carteira', 'somente_leitura')).toBe(true)
    expect(isCoherentAdvisorProfile('carteira', 'tudo')).toBe(false)
  })

  it('offers every value in the options with pt-BR labels and descriptions', () => {
    expect(ADVISOR_VISIBILITY_OPTIONS.map((option) => option.value)).toEqual(['carteira', 'tudo'])
    expect(ADVISOR_EDITING_OPTIONS.map((option) => option.value)).toEqual([
      'carteira',
      'tudo',
      'somente_leitura',
    ])
    for (const option of [...ADVISOR_VISIBILITY_OPTIONS, ...ADVISOR_EDITING_OPTIONS]) {
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.description.length).toBeGreaterThan(0)
    }
  })

  it('guards the enum values at the form boundary', () => {
    expect(isAdvisorVisibilityValue('tudo')).toBe(true)
    expect(isAdvisorVisibilityValue('todas')).toBe(false)
    expect(isAdvisorEditingValue('somente_leitura')).toBe(true)
    expect(isAdvisorEditingValue('readonly')).toBe(false)
    expect(isAdvisorEditingValue(null)).toBe(false)
  })
})
