import { describe, expect, it } from 'vitest'

import { DEFAULT_VOTE_ESTIMATE_SCENARIO } from '@/lib/voteEstimate'
import { parseMunicipalityListParams } from '@/utilities/municipality/municipalityListUrl'
import {
  applyMunicipalityOmniboxSuggestion,
  buildMunicipalityOmniboxChips,
  buildMunicipalityOmniboxSuggestions,
  clearMunicipalityOmnibox,
  removeMunicipalityOmniboxChip,
} from '@/utilities/municipality/municipalityOmnibox'

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
      stateDeputyLabelsById: new Map(),
      leadershipLabelsById: new Map(),
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
      stateDeputyLabelsById: new Map(),
      leadershipLabelsById: new Map(),
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
      stateDeputyFilterOptions: [],
      leadershipFilterOptions: [],
      partyFilterOptions: [],
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
      stateDeputyFilterOptions: [],
      leadershipFilterOptions: [],
      partyFilterOptions: [],
    })
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
  })

  it('suggests Dobradinha, Liderança and Partido options (B176)', () => {
    const suggestions = buildMunicipalityOmniboxSuggestions({
      query: 'mar',
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      slugFilterOptions: [],
      stateDeputyFilterOptions: [{ value: '12', label: 'Maria Souza (PSD)' }],
      leadershipFilterOptions: [{ value: '7', label: 'Maria de Fátima' }],
      partyFilterOptions: [{ value: 'PSD', label: 'PSD' }],
    })
    expect(suggestions.some((entry) => entry.id === 'stateDeputy:12')).toBe(true)
    expect(suggestions.some((entry) => entry.id === 'leadership:7')).toBe(true)
    // Typing a party acronym matches the label itself.
    const byParty = buildMunicipalityOmniboxSuggestions({
      query: 'psd',
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      slugFilterOptions: [],
      stateDeputyFilterOptions: [],
      leadershipFilterOptions: [],
      partyFilterOptions: [{ value: 'PSD', label: 'PSD' }],
    })
    expect(byParty.some((entry) => entry.id === 'party:PSD')).toBe(true)
  })

  it('reveals the "Sem …" sentinel options while typing "sem"', () => {
    const suggestions = buildMunicipalityOmniboxSuggestions({
      query: 'sem',
      showStaffFilters: true,
      regionFilterOptions: [],
      advisorFilterOptions: [],
      slugFilterOptions: [],
      stateDeputyFilterOptions: [],
      leadershipFilterOptions: [],
      partyFilterOptions: [],
    })
    expect(suggestions.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'stateDeputy:sem_dobradinha',
        'leadership:sem_lideranca',
        'party:sem_partido',
      ]),
    )
  })

  it('applies the B176 relation filters inclusively and removes single chips', () => {
    const applied = applyMunicipalityOmniboxSuggestion({
      state: base,
      suggestionId: 'stateDeputy:12',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind !== 'url') return
    expect(applied.state.stateDeputies).toEqual([12])

    const withSentinel = applyMunicipalityOmniboxSuggestion({
      state: applied.state,
      suggestionId: 'leadership:sem_lideranca',
    })
    expect(withSentinel.kind).toBe('url')
    if (withSentinel.kind === 'url') {
      expect(withSentinel.state.leaderships).toEqual(['sem_lideranca'])
    }

    const withParty = applyMunicipalityOmniboxSuggestion({
      state: base,
      suggestionId: 'party:PSD',
    })
    expect(withParty.kind).toBe('url')
    if (withParty.kind === 'url') expect(withParty.state.parties).toEqual(['PSD'])

    const removed = removeMunicipalityOmniboxChip({
      state: parseMunicipalityListParams({ stateDeputy: ['12', '5'] }),
      chipId: 'stateDeputy:5',
    })
    expect(removed.kind).toBe('url')
    if (removed.kind === 'url') expect(removed.state.stateDeputies).toEqual([12])
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

  it('apply search suggestion sets q without depending on draft search', () => {
    // Callers must navigate with action.state as-is (hook.navigate), not
    // navigateWithSearch which would re-inject the unused draft q.
    const applied = applyMunicipalityOmniboxSuggestion({
      state: parseMunicipalityListParams({ q: 'old' }),
      suggestionId: 'q:novo',
    })
    expect(applied).toEqual({
      kind: 'url',
      state: expect.objectContaining({ q: 'novo', page: 1 }),
    })
  })
})

describe('municipality omnibox — city slug (B178)', () => {
  it('labels the city slug chip with the aggregate name, never the raw slug', () => {
    const chips = buildMunicipalityOmniboxChips({
      state: parseMunicipalityListParams({ slug: 'salvador' }),
      scenario: 'central',
      showStaffFilters: true,
      advisorLabelsById: new Map(),
      stateDeputyLabelsById: new Map(),
      leadershipLabelsById: new Map(),
    })
    expect(chips.find((chip) => chip.id === 'slug:salvador')?.label).toBe(
      'Município: Salvador (cidade)',
    )
  })
})
