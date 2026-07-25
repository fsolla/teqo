import { describe, expect, it } from 'vitest'

import {
  isPlanilhaPlaceholderEmail,
  planilhaPlaceholderEmailForAdvisor,
} from '@/lib/schemas/advisor'

describe('isPlanilhaPlaceholderEmail', () => {
  it('detects the E4R seed suffix case-insensitively', () => {
    expect(isPlanilhaPlaceholderEmail('edizio@planilha.invalid')).toBe(true)
    expect(isPlanilhaPlaceholderEmail('Edizio@Planilha.Invalid')).toBe(true)
  })

  it('rejects real emails and empty values', () => {
    expect(isPlanilhaPlaceholderEmail('edizio@example.com')).toBe(false)
    expect(isPlanilhaPlaceholderEmail('')).toBe(false)
    expect(isPlanilhaPlaceholderEmail(null)).toBe(false)
    expect(isPlanilhaPlaceholderEmail(undefined)).toBe(false)
  })
})

describe('planilhaPlaceholderEmailForAdvisor', () => {
  it('builds a stable assessor-{id}@planilha.invalid address', () => {
    expect(planilhaPlaceholderEmailForAdvisor(42)).toBe('assessor-42@planilha.invalid')
  })
})
