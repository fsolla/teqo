// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { normalizeForSearch, uniqueByNormalizedForm } from '@/lib/speechSearch'

describe('normalizeForSearch', () => {
  it('strips accents, lowercases and collapses whitespace', () => {
    expect(normalizeForSearch('  Saúde   Pública ')).toBe('saude publica')
    expect(normalizeForSearch('São Félix do Coribe')).toBe('sao felix do coribe')
    expect(normalizeForSearch('')).toBe('')
  })
})

describe('uniqueByNormalizedForm', () => {
  it('dedupes by normalized form keeping the first spelling', () => {
    expect(uniqueByNormalizedForm(['Saúde', 'saude', 'SUS', ' sus '])).toEqual(['Saúde', 'SUS'])
  })

  it('drops empty values', () => {
    expect(uniqueByNormalizedForm(['', '  ', 'Bahia'])).toEqual(['Bahia'])
  })
})
