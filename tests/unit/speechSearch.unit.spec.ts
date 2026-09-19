// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  normalizeForSearch,
  speechMatchesSearchQuery,
  speechMatchesSearchTerm,
  uniqueByNormalizedForm,
} from '@/lib/speechSearch'

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

describe('speechMatchesSearchQuery', () => {
  it('matches the normalized search text accent- and case-insensitively', () => {
    const speech = { searchText: 'a saude publica baiana', keywords: [] }
    expect(speechMatchesSearchQuery(speech, 'SAÚDE Pública')).toBe(true)
    expect(speechMatchesSearchQuery(speech, 'educação')).toBe(false)
  })

  it('matches an official keyword case-insensitively, accent still significant', () => {
    const speech = { searchText: '', keywords: ['Farmácia Popular', 'SUS'] }
    expect(speechMatchesSearchQuery(speech, 'farmácia popular')).toBe(true)
    expect(speechMatchesSearchQuery(speech, 'FARMÁCIA')).toBe(true)
    // the SQL is ILIKE `%q%`: a different accent would not match there either
    expect(speechMatchesSearchQuery(speech, 'farmacia')).toBe(false)
  })

  it('treats an empty or missing query as a match', () => {
    const speech = { searchText: null, keywords: null }
    expect(speechMatchesSearchQuery(speech, undefined)).toBe(true)
    expect(speechMatchesSearchQuery(speech, '   ')).toBe(true)
  })
})

describe('speechMatchesSearchTerm (C192)', () => {
  it('mirrors a single textual where branch', () => {
    const speech = { searchText: 'a saude publica baiana', keywords: ['Farmácia Popular'] }
    expect(speechMatchesSearchTerm(speech, 'SAÚDE Pública')).toBe(true)
    expect(speechMatchesSearchTerm(speech, 'FARMÁCIA')).toBe(true)
    expect(speechMatchesSearchTerm(speech, 'educação')).toBe(false)
  })

  it('never matches an empty term', () => {
    const speech = { searchText: 'a saude publica', keywords: ['SUS'] }
    expect(speechMatchesSearchTerm(speech, undefined)).toBe(false)
    expect(speechMatchesSearchTerm(speech, '   ')).toBe(false)
  })
})
