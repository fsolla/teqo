// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  applyRecordingOmniboxSuggestion,
  applyRecordingSearchMode,
  buildRecordingOmniboxChips,
  buildRecordingOmniboxSuggestionSeeds,
  clearRecordingOmnibox,
  filterRecordingOmniboxSuggestions,
  removeRecordingOmniboxChip,
} from '@/utilities/recordings/recordingOmnibox'

const labels = new Map<number, string>([[42, 'Feira de Santana']])

describe('recordings omnibox (C219)', () => {
  it('builds one chip per active filter with the facet labels', () => {
    const chips = buildRecordingOmniboxChips({
      state: {
        source: 'enviadas',
        page: 1,
        q: 'merenda',
        years: [2026],
        topics: ['saude'],
        scopes: ['bahia'],
        municipalities: [42],
        durations: ['curta'],
        people: ['Dep. Jorge Solla'],
      },
      municipalityLabelsById: labels,
    })
    expect(chips.map((chip) => chip.label)).toEqual([
      'Busca: merenda',
      'Ano: 2026',
      'Tema: Saúde',
      'Alcance: Bahia',
      'Município citado: Feira de Santana',
      'Duração: Até 2 min',
      'Pessoa: Dep. Jorge Solla',
    ])
  })

  it('falls back to the id when the municipality label is not loaded', () => {
    const chips = buildRecordingOmniboxChips({
      state: { source: 'enviadas', page: 1, municipalities: [99] },
      municipalityLabelsById: labels,
    })
    expect(chips).toEqual([{ id: 'municipality:99', label: 'Município citado: Município #99' }])
  })

  it('applies the query suggestion resetting the page and keeping the source', () => {
    const action = applyRecordingOmniboxSuggestion({
      state: { source: 'enviadas', page: 4 },
      suggestionId: 'q:merenda escolar',
    })
    expect(action).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, q: 'merenda escolar' },
    })
  })

  it('toggles facets and people (person dedupes case-insensitively)', () => {
    const base = { source: 'enviadas' as const, page: 3 }

    expect(applyRecordingOmniboxSuggestion({ state: base, suggestionId: 'topic:saude' })).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, topics: ['saude'] },
    })

    expect(applyRecordingOmniboxSuggestion({ state: base, suggestionId: 'year:2026' })).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, years: [2026] },
    })

    expect(
      applyRecordingOmniboxSuggestion({ state: base, suggestionId: 'municipality:42' }),
    ).toEqual({ kind: 'url', state: { source: 'enviadas', page: 1, municipalities: [42] } })

    const withPerson = applyRecordingOmniboxSuggestion({
      state: base,
      suggestionId: 'person:Dep. Jorge Solla',
    })
    expect(withPerson).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, people: ['Dep. Jorge Solla'] },
    })

    const removedPerson = applyRecordingOmniboxSuggestion({
      state: { source: 'enviadas', page: 1, people: ['Dep. Jorge Solla'] },
      suggestionId: 'person:dep. jorge solla',
    })
    expect(removedPerson).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, people: undefined },
    })

    // An invalid numeric id never mutates the state.
    expect(applyRecordingOmniboxSuggestion({ state: base, suggestionId: 'year:abc' })).toEqual({
      kind: 'url',
      state: base,
    })
  })

  it('removes chips (dropping the query also drops the theme mode)', () => {
    expect(
      removeRecordingOmniboxChip({
        state: { source: 'enviadas', page: 2, q: 'merenda', mode: 'tema' },
        chipId: 'q',
      }),
    ).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, q: undefined, mode: undefined },
    })

    expect(
      removeRecordingOmniboxChip({
        state: { source: 'enviadas', page: 2, topics: ['saude', 'cultura'] },
        chipId: 'topic:saude',
      }),
    ).toEqual({ kind: 'url', state: { source: 'enviadas', page: 1, topics: ['cultura'] } })

    expect(
      removeRecordingOmniboxChip({
        state: { source: 'enviadas', page: 2, people: ['Solla'] },
        chipId: 'person:Solla',
      }),
    ).toEqual({ kind: 'url', state: { source: 'enviadas', page: 1, people: undefined } })
  })

  it('keeps a person label with a colon intact through the chip round trip', () => {
    const state = { source: 'enviadas' as const, page: 1, people: ['Ana: assessora'] }
    expect(buildRecordingOmniboxChips({ state, municipalityLabelsById: labels })).toEqual([
      { id: 'person:Ana: assessora', label: 'Pessoa: Ana: assessora' },
    ])
    expect(removeRecordingOmniboxChip({ state, chipId: 'person:Ana: assessora' })).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, people: undefined },
    })
  })

  it('toggles the theme mode only with a query and clears back to the source', () => {
    expect(
      applyRecordingSearchMode({
        state: { source: 'enviadas', page: 2, q: 'merenda' },
        mode: 'tema',
      }),
    ).toEqual({
      kind: 'url',
      state: { source: 'enviadas', page: 1, q: 'merenda', mode: 'tema' },
    })

    expect(
      applyRecordingSearchMode({ state: { source: 'enviadas', page: 1 }, mode: 'tema' }),
    ).toEqual({ kind: 'url', state: { source: 'enviadas', page: 1 } })

    expect(
      applyRecordingSearchMode({
        state: { source: 'enviadas', page: 1, q: 'merenda', mode: 'tema' },
        mode: 'termo',
      }),
    ).toEqual({ kind: 'url', state: { source: 'enviadas', page: 1, q: 'merenda' } })

    expect(
      clearRecordingOmnibox({ source: 'enviadas', page: 3, q: 'merenda', topics: ['saude'] }),
    ).toEqual({ kind: 'clear', state: { source: 'enviadas', page: 1 } })
  })

  it('seeds the taxonomy up front and the data-driven options by keyword', () => {
    const seeds = buildRecordingOmniboxSuggestionSeeds({
      years: [2026],
      municipalityOptions: [{ value: '42', label: 'Feira de Santana' }],
      personOptions: ['Dep. Jorge Solla'],
    })

    const emptyQuery = filterRecordingOmniboxSuggestions(seeds, '')
    expect(emptyQuery.some((suggestion) => suggestion.id === 'topic:saude')).toBe(true)
    expect(emptyQuery.some((suggestion) => suggestion.id === 'scope:bahia')).toBe(true)
    expect(emptyQuery.some((suggestion) => suggestion.id === 'duration:curta')).toBe(true)
    // Years, municipalities and people are searchable, not shown up front.
    expect(emptyQuery.some((suggestion) => suggestion.id === 'year:2026')).toBe(false)
    expect(emptyQuery.some((suggestion) => suggestion.id === 'person:Dep. Jorge Solla')).toBe(false)

    // The typed query itself is always the first suggestion; the facet seed
    // follows it when it matches.
    expect(filterRecordingOmniboxSuggestions(seeds, 'feira').map((s) => s.id)).toContain(
      'municipality:42',
    )
    expect(filterRecordingOmniboxSuggestions(seeds, '2026').map((s) => s.id)).toContain('year:2026')
    expect(filterRecordingOmniboxSuggestions(seeds, 'falante').map((s) => s.id)).toContain(
      'person:Dep. Jorge Solla',
    )
    expect(filterRecordingOmniboxSuggestions(seeds, 'municipio').map((s) => s.id)).toContain(
      'municipality:42',
    )
  })
})
