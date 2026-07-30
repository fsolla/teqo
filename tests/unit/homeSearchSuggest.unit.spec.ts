import { describe, expect, it } from 'vitest'

import {
  HOME_SEARCH_SUGGEST_LIMIT,
  rankHomeSearchSuggestMunicipalities,
  type HomeSearchSuggestMunicipalityInput,
} from '@/lib/homeSearchSuggest'

const row = (
  partial: Partial<HomeSearchSuggestMunicipalityInput> &
    Pick<HomeSearchSuggestMunicipalityInput, 'slug' | 'name'>,
): HomeSearchSuggestMunicipalityInput => ({
  region: 'TI',
  priority: 'normal',
  lastSignalAt: null,
  centralDeficitSortValue: null,
  ...partial,
})

describe('rankHomeSearchSuggestMunicipalities', () => {
  it('ranks advisor portfolio by oldest signal first, then name', () => {
    const municipalities = [
      row({ slug: 'b', name: 'Brumado', lastSignalAt: '2026-07-20T12:00:00.000Z' }),
      row({ slug: 'a', name: 'Abaíra', lastSignalAt: null }),
      row({ slug: 'c', name: 'Cairu', lastSignalAt: '2026-07-01T12:00:00.000Z' }),
    ]

    const ranked = rankHomeSearchSuggestMunicipalities('advisor', municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['a', 'c', 'b'])
  })

  it('caps advisor results at HOME_SEARCH_SUGGEST_LIMIT', () => {
    const municipalities = Array.from({ length: 12 }, (_, index) =>
      row({
        slug: `m-${index}`,
        name: `Município ${index}`,
        lastSignalAt: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    )

    const ranked = rankHomeSearchSuggestMunicipalities('advisor', municipalities)
    expect(ranked).toHaveLength(HOME_SEARCH_SUGGEST_LIMIT)
  })

  it('ranks coordinator suggestions to high-priority municipalities by central deficit', () => {
    const municipalities = [
      row({
        slug: 'low',
        name: 'Low',
        priority: 'alta',
        centralDeficitSortValue: 10,
        lastSignalAt: '2026-07-20T12:00:00.000Z',
      }),
      row({
        slug: 'high',
        name: 'High',
        priority: 'alta',
        centralDeficitSortValue: 500,
        lastSignalAt: '2026-07-20T12:00:00.000Z',
      }),
      row({
        slug: 'normal',
        name: 'Normal',
        priority: 'normal',
        centralDeficitSortValue: 900,
      }),
    ]

    const ranked = rankHomeSearchSuggestMunicipalities('coordinator', municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['high', 'low'])
  })

  it('breaks coordinator deficit ties by colder signal', () => {
    const municipalities = [
      row({
        slug: 'warm',
        name: 'Warm',
        priority: 'alta',
        centralDeficitSortValue: 100,
        lastSignalAt: '2026-07-28T12:00:00.000Z',
      }),
      row({
        slug: 'cold',
        name: 'Cold',
        priority: 'alta',
        centralDeficitSortValue: 100,
        lastSignalAt: '2026-06-01T12:00:00.000Z',
      }),
    ]

    const ranked = rankHomeSearchSuggestMunicipalities('candidate', municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['cold', 'warm'])
  })

  it('returns empty for leader', () => {
    const municipalities = [row({ slug: 'a', name: 'A' })]
    expect(rankHomeSearchSuggestMunicipalities('leader', municipalities)).toEqual([])
  })
})
