import { describe, expect, it } from 'vitest'

import {
  applyActivityAgendaOmniboxSuggestion,
  buildActivityAgendaOmniboxChips,
  buildActivityAgendaOmniboxSuggestionSeeds,
  clearActivityAgendaOmnibox,
  filterActivityAgendaOmniboxSuggestions,
  removeActivityAgendaOmniboxChip,
} from '@/utilities/activityAgendaOmnibox'

const municipalityLabelsById = new Map<number, string>([
  [12, 'Salvador'],
  [34, 'Feira de Santana'],
])

const municipalityOptions = [
  { value: '12', label: 'Salvador' },
  { value: '34', label: 'Feira de Santana' },
]

describe('agenda omnibox adapter (C94)', () => {
  it('builds removable chips for the three dimensions', () => {
    const chips = buildActivityAgendaOmniboxChips({
      state: { municipality: 12, tag: 'Comício', deputyPresent: true },
      municipalityLabelsById,
    })
    expect(chips.map((chip) => chip.id)).toEqual([
      'municipality:12',
      'tag:Comício',
      'deputyPresent',
    ])
    expect(chips[0]!.label).toBe('Município: Salvador')
    expect(chips[1]!.label).toBe('Tag: Comício')
    expect(chips[2]!.label).toBe('Deputado presente')
  })

  it('falls back to the numeric id when a municipality label is unknown', () => {
    const chips = buildActivityAgendaOmniboxChips({
      state: { municipality: 99 },
      municipalityLabelsById,
    })
    expect(chips[0]!.label).toBe('Município: Município #99')
  })

  it('suggests deputado presente and tags on empty query, municípios by typing', () => {
    const seeds = buildActivityAgendaOmniboxSuggestionSeeds({
      municipalityOptions,
      knownTags: ['Comício', 'Panfletagem'],
    })

    const emptyQuery = filterActivityAgendaOmniboxSuggestions(seeds, '')
    expect(emptyQuery.some((entry) => entry.id === 'deputyPresent')).toBe(true)
    expect(emptyQuery.some((entry) => entry.id === 'tag:Comício')).toBe(true)
    expect(emptyQuery.some((entry) => entry.id === 'municipality:12')).toBe(false)

    const typed = filterActivityAgendaOmniboxSuggestions(seeds, 'feira')
    expect(typed.some((entry) => entry.id === 'municipality:34')).toBe(true)

    const grouped = typed.find((entry) => entry.id === 'municipality:34')
    expect(grouped?.group).toBe('Município')
  })

  it('never surfaces the free-text Busca row (no text search on the agenda)', () => {
    const seeds = buildActivityAgendaOmniboxSuggestionSeeds({
      municipalityOptions,
      knownTags: ['Comício'],
    })
    const suggestions = filterActivityAgendaOmniboxSuggestions(seeds, 'comí')
    expect(suggestions.some((entry) => entry.id.startsWith('q:'))).toBe(false)
  })

  it('toggles deputado presente on and off', () => {
    const on = applyActivityAgendaOmniboxSuggestion({
      state: {},
      suggestionId: 'deputyPresent',
    })
    expect(on.kind).toBe('url')
    if (on.kind === 'url') expect(on.state.deputyPresent).toBe(true)

    const off = applyActivityAgendaOmniboxSuggestion({
      state: { deputyPresent: true },
      suggestionId: 'deputyPresent',
    })
    expect(off.kind).toBe('url')
    if (off.kind === 'url') expect(off.state.deputyPresent).toBeUndefined()
  })

  it('toggles tag and municipality and removes chips', () => {
    const base = { municipality: 12, tag: 'Comício' }
    const toggledTag = applyActivityAgendaOmniboxSuggestion({
      state: base,
      suggestionId: 'tag:Comício',
    })
    if (toggledTag.kind === 'url') expect(toggledTag.state.tag).toBeUndefined()

    const toggledMunicipality = applyActivityAgendaOmniboxSuggestion({
      state: base,
      suggestionId: 'municipality:34',
    })
    if (toggledMunicipality.kind === 'url') expect(toggledMunicipality.state.municipality).toBe(34)

    const removedMunicipality = removeActivityAgendaOmniboxChip({
      state: { municipality: 12 },
      chipId: 'municipality:12',
    })
    if (removedMunicipality.kind === 'url')
      expect(removedMunicipality.state.municipality).toBeUndefined()

    const removedDeputy = removeActivityAgendaOmniboxChip({
      state: { deputyPresent: true },
      chipId: 'deputyPresent',
    })
    if (removedDeputy.kind === 'url') expect(removedDeputy.state.deputyPresent).toBeUndefined()
  })

  it('ignores invalid suggestion ids and q: leftovers with a no-op url action', () => {
    const state = { tag: 'Comício' }
    const bogus = applyActivityAgendaOmniboxSuggestion({ state, suggestionId: 'q:whatever' })
    expect(bogus.kind).toBe('url')
    if (bogus.kind === 'url') expect(bogus.state.tag).toBe('Comício')

    const invalid = applyActivityAgendaOmniboxSuggestion({
      state,
      suggestionId: 'municipality:abc',
    })
    expect(invalid.kind).toBe('url')
    if (invalid.kind === 'url') expect(invalid.state.tag).toBe('Comício')
  })

  it('clears to an empty agenda state', () => {
    const cleared = clearActivityAgendaOmnibox()
    expect(cleared.kind).toBe('clear')
  })
})
