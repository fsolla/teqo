// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildHighlightedExcerpt,
  findHighlightRanges,
  findPhraseRanges,
  matchesSearchTerms,
  splitHighlightedParts,
} from '@/lib/speechHighlight'

const highlighted = (text: string, query: string): string[] =>
  splitHighlightedParts(text, query)
    .filter((part) => part.highlighted)
    .map((part) => part.text)

describe('findHighlightRanges', () => {
  it('maps an accent-free query back to the accented original spelling', () => {
    const text = 'A defesa do SUS e da saúde pública'
    expect(findHighlightRanges(text, 'saude')).toEqual([{ start: 21, end: 26 }])
    expect(highlighted(text, 'saude')).toEqual(['saúde'])
  })

  it('finds every term of a multi-word query, accent-insensitively', () => {
    const text = 'O Governo retomou a Farmácia Popular na Bahia'
    expect(highlighted(text, 'farmacia popular')).toEqual(['Farmácia', 'Popular'])
    expect(highlighted(text, 'FARMÁCIA')).toEqual(['Farmácia'])
  })

  it('merges overlapping occurrences', () => {
    expect(findHighlightRanges('banana', 'ana')).toEqual([{ start: 1, end: 6 }])
  })

  it('handles whitespace and punctuation around the match', () => {
    const text = '  saúde,\n  educação  '
    expect(highlighted(text, 'saude educacao')).toEqual(['saúde', 'educação'])
  })

  it('returns nothing for an empty query or a miss', () => {
    expect(findHighlightRanges('texto', '')).toEqual([])
    expect(findHighlightRanges('texto', 'inexistente')).toEqual([])
  })
})

describe('findPhraseRanges (C192)', () => {
  it('highlights the whole phrase as one continuous range, keeping the accents', () => {
    const text = 'Defendemos o atendimento público e acesso universal à saúde para todos'
    const ranges = findPhraseRanges(text, 'acesso universal à saúde')

    expect(ranges).toHaveLength(1)
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toBe('acesso universal à saúde')
  })

  it('finds overlapping occurrences of the same phrase', () => {
    expect(findPhraseRanges('ana ana', 'ana')).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ])
  })

  it('falls back to the per-term ranges when the phrase is not contiguous', () => {
    const ranges = findPhraseRanges('saúde pública e muito acesso', 'acesso universal')
    expect(ranges).toEqual([{ start: 22, end: 28 }])
  })

  it('returns nothing for an empty phrase', () => {
    expect(findPhraseRanges('texto', '')).toEqual([])
  })
})

describe('matchesSearchTerms', () => {
  it('requires every term, in any order', () => {
    expect(matchesSearchTerms('A defesa do SUS e da saúde', 'saude sus')).toBe(true)
    expect(matchesSearchTerms('A defesa do SUS', 'saude educacao')).toBe(false)
    expect(matchesSearchTerms('A defesa do SUS', '')).toBe(false)
  })
})

describe('buildHighlightedExcerpt', () => {
  it('windows around the first match and flags truncation', () => {
    const text = `${'a'.repeat(300)} saúde ${'b'.repeat(300)}`
    const excerpt = buildHighlightedExcerpt(text, 'saude', { radius: 20 })

    expect(excerpt.truncatedStart).toBe(true)
    expect(excerpt.truncatedEnd).toBe(true)
    const parts = excerpt.parts
    expect(parts.some((part) => part.highlighted && part.text === 'saúde')).toBe(true)
  })

  it('falls back to the text start without highlights when nothing matches', () => {
    const excerpt = buildHighlightedExcerpt('Uma fala sem o termo buscado', 'inexistente', {
      radius: 10,
    })
    expect(excerpt.parts.every((part) => !part.highlighted)).toBe(true)
    expect(excerpt.truncatedStart).toBe(false)
    expect(excerpt.truncatedEnd).toBe(true)
  })

  it('returns empty parts for empty text', () => {
    expect(buildHighlightedExcerpt('   ', 'saude').parts).toEqual([])
  })
})
