import { describe, expect, it } from 'vitest'

import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import {
  applyMunicipalityOmniboxSuggestion,
  buildMunicipalityOmniboxChips,
  buildMunicipalityOmniboxSuggestions,
  clearMunicipalityOmnibox,
  removeMunicipalityOmniboxChip,
} from '@/utilities/municipality/municipalityOmnibox'
import { parseMunicipalityListParams } from '@/utilities/municipality/municipalityListUrl'

describe('municipality omnibox (B127)', () => {
  const base = parseMunicipalityListParams({})

  it('builds chips from URL filters and non-default presentation', () => {
    const state = parseMunicipalityListParams({
      q: 'feira',
      priority: 'alta',
      region: 'Recôncavo',
      sort: 'name',
      dir: 'asc',
    })
    const chips = buildMunicipalityOmniboxChips({
      state,
      scenario: 'optimistic',
      showStaffFilters: true,
      advisorLabelsById: new Map(),
    })
    expect(chips.map((chip) => chip.id)).toEqual([
      'q',
      'priority',
      'region:Recôncavo',
      'scenario',
      'sort',
    ])
    expect(chips.find((chip) => chip.id === 'q')?.label).toBe('Busca: feira')
  })

  it('hides default scenario and default sort chips', () => {
    const chips = buildMunicipalityOmniboxChips({
      state: base,
      scenario: DEFAULT_VOTE_ESTIMATE_SCENARIO,
      showStaffFilters: true,
      advisorLabelsById: new Map(),
    })
    expect(chips).toEqual([])
  })

  it('suggests Busca and matching dimensions from typed text', () => {
    const suggestions = buildMunicipalityOmniboxSuggestions({
      query: 'pri',
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      slugFilterOptions: [{ value: 'salvador', label: 'Salvador' }],
    })
    expect(suggestions.some((entry) => entry.id === 'q:pri')).toBe(true)
    expect(suggestions.some((entry) => entry.id === 'priority:alta')).toBe(true)
  })

  it('suggests sort options when typing ordenar', () => {
    const suggestions = buildMunicipalityOmniboxSuggestions({
      query: 'ordenar',
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      slugFilterOptions: [],
    })
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
  })

  it('applies text search and toggles inclusive filters', () => {
    const search = applyMunicipalityOmniboxSuggestion({
      state: base,
      suggestionId: 'q:Salvador',
    })
    expect(search).toEqual({
      kind: 'url',
      state: expect.objectContaining({ q: 'Salvador', page: 1 }),
    })

    const withRegion = applyMunicipalityOmniboxSuggestion({
      state: base,
      suggestionId: 'region:Recôncavo',
    })
    expect(withRegion.kind).toBe('url')
    if (withRegion.kind === 'url') {
      expect(withRegion.state.regions).toEqual(['Recôncavo'])
    }
  })

  it('applies scenario as presentation action and clears to central', () => {
    const applied = applyMunicipalityOmniboxSuggestion({
      state: base,
      suggestionId: 'scenario:optimistic',
    })
    expect(applied).toEqual({ kind: 'scenario', scenario: 'optimistic' })

    const removed = removeMunicipalityOmniboxChip({
      state: base,
      chipId: 'scenario',
    })
    expect(removed).toEqual({ kind: 'scenario', scenario: 'central' })
  })

  it('removes a single multi-value chip without clearing siblings', () => {
    const state = parseMunicipalityListParams({
      region: ['Recôncavo', 'Portal do Sertão'],
    })
    const next = removeMunicipalityOmniboxChip({ state, chipId: 'region:Recôncavo' })
    expect(next.kind).toBe('url')
    if (next.kind === 'url') {
      expect(next.state.regions).toEqual(['Portal do Sertão'])
    }
  })

  it('clear drops filters and resets scenario to central, keeping sort', () => {
    const state = parseMunicipalityListParams({
      q: 'x',
      priority: 'alta',
      sort: 'name',
      dir: 'asc',
    })
    expect(clearMunicipalityOmnibox(state)).toEqual({
      kind: 'clear',
      state: { page: 1, sort: 'name', dir: 'asc' },
      scenario: 'central',
    })
  })
})
