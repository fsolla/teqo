import { describe, expect, it } from 'vitest'

import { HOME_SEARCH_SUGGEST_LIMIT } from '@/lib/homeSearchSuggest'
import {
  rankWizardMunicipalitySuggestions,
  type WizardMunicipalitySuggestInput,
} from '@/lib/wizardMunicipalitySuggest'

const row = (
  partial: Partial<WizardMunicipalitySuggestInput> &
    Pick<WizardMunicipalitySuggestInput, 'slug' | 'name'>,
): WizardMunicipalitySuggestInput => ({
  lastSignalAt: null,
  engagementLevel: null,
  politicalTrend: null,
  territorialClass: 'manutencao',
  votes2022: null,
  ...partial,
})

describe('rankWizardMunicipalitySuggestions', () => {
  it('ranks by oldest signal first, then name', () => {
    const municipalities = [
      row({ slug: 'b', name: 'Brumado', lastSignalAt: '2026-07-20T12:00:00.000Z' }),
      row({ slug: 'a', name: 'Abaíra', lastSignalAt: null }),
      row({ slug: 'c', name: 'Cairu', lastSignalAt: '2026-07-01T12:00:00.000Z' }),
    ]

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['a', 'c', 'b'])
  })

  it('breaks signal ties by engagement level (higher first)', () => {
    const municipalities = [
      row({
        slug: 'low',
        name: 'Low',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        engagementLevel: 'n1',
      }),
      row({
        slug: 'high',
        name: 'High',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        engagementLevel: 'n4',
      }),
    ]

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['high', 'low'])
  })

  it('breaks engagement ties by political trend (desfavorável first)', () => {
    const municipalities = [
      row({
        slug: 'fav',
        name: 'Fav',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        engagementLevel: 'n2',
        politicalTrend: 'favoravel',
      }),
      row({
        slug: 'des',
        name: 'Des',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        engagementLevel: 'n2',
        politicalTrend: 'desfavoravel',
      }),
    ]

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['des', 'fav'])
  })

  it('breaks trend ties by territorial class (reduto before marginal)', () => {
    const municipalities = [
      row({
        slug: 'marg',
        name: 'Marg',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        territorialClass: 'marginal',
      }),
      row({
        slug: 'red',
        name: 'Red',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        territorialClass: 'reduto',
      }),
    ]

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['red', 'marg'])
  })

  it('breaks class ties by 2022 votes (higher first)', () => {
    const municipalities = [
      row({
        slug: 'low',
        name: 'Low',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        votes2022: 100,
      }),
      row({
        slug: 'high',
        name: 'High',
        lastSignalAt: '2026-07-01T12:00:00.000Z',
        votes2022: 5000,
      }),
    ]

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked.map((m) => m.slug)).toEqual(['high', 'low'])
  })

  it('caps results at HOME_SEARCH_SUGGEST_LIMIT', () => {
    const municipalities = Array.from({ length: 12 }, (_, index) =>
      row({
        slug: `m-${index}`,
        name: `Município ${index}`,
        lastSignalAt: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    )

    const ranked = rankWizardMunicipalitySuggestions(municipalities)
    expect(ranked).toHaveLength(HOME_SEARCH_SUGGEST_LIMIT)
  })
})
