// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { parseSpeechListParams, type SpeechListState } from '@/utilities/speech/speechListUrl'
import {
  applySpeechOmniboxSuggestion,
  buildSpeechOmniboxChips,
  clearSpeechOmnibox,
  removeSpeechOmniboxChip,
} from '@/utilities/speech/speechOmnibox'

const state = (params: Record<string, string | string[]>): SpeechListState =>
  parseSpeechListParams(params)

describe('buildSpeechOmniboxChips', () => {
  it('labels every active facet', () => {
    const chips = buildSpeechOmniboxChips({
      state: state({
        q: 'Farmácia Popular',
        year: '2026',
        topic: ['saude'],
        scope: ['bahia'],
        phase: ['Breves Comunicações'],
        municipality: '12',
        duration: ['curta'],
      }),
      municipalityLabelsById: new Map([[12, 'Camaçari']]),
    })

    expect(chips.map((chip) => chip.label)).toEqual([
      'Busca: Farmácia Popular',
      'Ano: 2026',
      'Tema: Saúde',
      'Alcance: Bahia',
      'Fase: Breves Comunicações',
      'Município: Camaçari',
      'Duração: Até 2 min',
    ])
  })
})

describe('applySpeechOmniboxSuggestion', () => {
  it('sets the search query and resets the page', () => {
    const action = applySpeechOmniboxSuggestion({
      state: state({ page: '4', topic: ['saude'] }),
      suggestionId: 'q:SUS',
    })
    expect(action).toEqual({
      kind: 'url',
      state: { page: 1, q: 'SUS', topics: ['saude'] },
    })
  })

  it('toggles a facet value on and off', () => {
    const on = applySpeechOmniboxSuggestion({
      state: state({ topic: ['saude'] }),
      suggestionId: 'topic:educacao',
    })
    expect(on.state.topics).toEqual(['saude', 'educacao'])

    const off = applySpeechOmniboxSuggestion({
      state: state({ topic: ['saude', 'educacao'] }),
      suggestionId: 'topic:saude',
    })
    expect(off.state.topics).toEqual(['educacao'])
  })

  it('toggles numeric facets', () => {
    const action = applySpeechOmniboxSuggestion({
      state: state({ municipality: '12' }),
      suggestionId: 'municipality:12',
    })
    expect(action.state.municipalities).toBeUndefined()

    const years = applySpeechOmniboxSuggestion({
      state: state({}),
      suggestionId: 'year:2026',
    })
    expect(years.state.years).toEqual([2026])
  })
})

describe('removeSpeechOmniboxChip', () => {
  it('removes a single facet value and clears the field when it was the last', () => {
    const kept = removeSpeechOmniboxChip({
      state: state({ topic: ['saude', 'educacao'] }),
      chipId: 'topic:saude',
    })
    expect(kept.state.topics).toEqual(['educacao'])

    const emptied = removeSpeechOmniboxChip({
      state: state({ topic: ['saude'] }),
      chipId: 'topic:saude',
    })
    expect(emptied.state.topics).toBeUndefined()
  })

  it('removes the search chip', () => {
    const action = removeSpeechOmniboxChip({ state: state({ q: 'SUS' }), chipId: 'q' })
    expect(action.state.q).toBeUndefined()
  })
})

describe('clearSpeechOmnibox', () => {
  it('resets every filter', () => {
    expect(clearSpeechOmnibox(state({ q: 'SUS', topic: ['saude'] }))).toEqual({
      kind: 'clear',
      state: { page: 1 },
    })
  })
})
