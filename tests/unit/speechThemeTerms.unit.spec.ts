// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { MAX_SPEECH_THEME_TERMS, normalizeSpeechThemeTerms } from '@/lib/speechThemeTerms'

describe('normalizeSpeechThemeTerms (C192)', () => {
  it('removes LIKE wildcards so the expansion cannot widen the pattern', () => {
    expect(normalizeSpeechThemeTerms(['saúde%', 'a_b', 'c\\d'])).toEqual(['saúde', 'a b', 'c d'])
  })

  it('drops empty and too-short terms', () => {
    expect(normalizeSpeechThemeTerms(['', '  ', 'ab', 'SUS', 'de'])).toEqual(['SUS'])
  })

  it('dedupes by normalized form keeping the first spelling', () => {
    expect(normalizeSpeechThemeTerms(['Saúde Pública', 'saude publica', 'SUS'])).toEqual([
      'Saúde Pública',
      'SUS',
    ])
  })

  it('caps the list length', () => {
    const values = Array.from({ length: 20 }, (_, index) => `termo ${index}`)
    expect(normalizeSpeechThemeTerms(values)).toHaveLength(MAX_SPEECH_THEME_TERMS)
  })

  it('truncates a single term to the max length', () => {
    const term = 'x'.repeat(90)
    expect(normalizeSpeechThemeTerms([term])[0]).toHaveLength(60)
  })
})
