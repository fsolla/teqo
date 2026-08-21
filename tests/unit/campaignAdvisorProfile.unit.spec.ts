import { describe, expect, it } from 'vitest'

import {
  ADVISOR_EDITING_OPTIONS,
  ADVISOR_VISIBILITY_OPTIONS,
  advisorEditingScope,
  advisorProfileLabel,
  isAdvisorEditingValue,
  isAdvisorVisibilityValue,
  isCoherentAdvisorProfile,
  rowEditingAllowed,
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

  it('C142 advisorEditingScope maps the Edição axis to a write-scope decision', () => {
    expect(advisorEditingScope('carteira', 'carteira')).toBe('carteira')
    expect(advisorEditingScope('tudo', 'carteira')).toBe('carteira')
    expect(advisorEditingScope('tudo', 'tudo')).toBe('tudo')
    expect(advisorEditingScope('carteira', 'somente_leitura')).toBe('none')
    expect(advisorEditingScope('tudo', 'somente_leitura')).toBe('none')
    expect(advisorEditingScope('carteira', undefined)).toBe('carteira')
    expect(advisorEditingScope(undefined, undefined)).toBe('carteira')
  })

  it('C142 advisorEditingScope fails closed on the incoherent combination', () => {
    expect(advisorEditingScope('carteira', 'tudo')).toBe('none')
  })

  it('C142 rowEditingAllowed gates a row under a carteira scope by portfolio intersection', () => {
    const portfolio = [1, 2, 3]
    expect(rowEditingAllowed('tudo', portfolio, [9])).toBe(true)
    expect(rowEditingAllowed('tudo', null, [9])).toBe(true)
    expect(rowEditingAllowed('none', portfolio, [1])).toBe(false)
    expect(rowEditingAllowed('none', null, [1])).toBe(false)
    expect(rowEditingAllowed('carteira', portfolio, [2, 9])).toBe(true)
    expect(rowEditingAllowed('carteira', portfolio, [9])).toBe(false)
    expect(rowEditingAllowed('carteira', null, [9])).toBe(true)
    expect(rowEditingAllowed('carteira', portfolio, [])).toBe(false)
    expect(rowEditingAllowed('carteira', portfolio, null)).toBe(false)
  })
})
