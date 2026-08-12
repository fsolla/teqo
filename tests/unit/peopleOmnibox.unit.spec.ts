import { describe, expect, it } from 'vitest'

import { parsePeopleListParams } from '@/utilities/people/peopleListUrl'
import {
  applyPeopleOmniboxSuggestion,
  buildPeopleOmniboxChips,
  buildPeopleOmniboxSuggestionSeeds,
  filterPeopleOmniboxSuggestions,
  removePeopleOmniboxChip,
} from '@/utilities/people/peopleOmnibox'

const seeds = buildPeopleOmniboxSuggestionSeeds({
  municipalityFilterOptions: [],
  partyFilterOptions: [],
})

const sortSeedsIn = (query: string) =>
  filterPeopleOmniboxSuggestions(seeds, query).filter((entry) => entry.group === 'Ordenação')

describe('people omnibox — sort discovery (C125)', () => {
  it('typing "ordenar" surfaces every sort key, one seed each in the primary direction', () => {
    const suggestions = sortSeedsIn('ordenar')
    expect(suggestions.map((entry) => entry.id)).toEqual([
      'sort:name|asc',
      'sort:contact|asc',
      'sort:assessora|desc',
      'sort:lidera|desc',
      'sort:aliada|desc',
      'sort:assessorado|desc',
      'sort:base|asc',
      'sort:party|asc',
    ])
    expect(suggestions.map((entry) => entry.label)).toContain('Dobra em (maior → menor)')
    expect(suggestions.map((entry) => entry.label)).toContain('Base (A–Z)')
  })

  it('shows the Ordenação group on an empty query (mobile discovery)', () => {
    const suggestions = filterPeopleOmniboxSuggestions(seeds, '')
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
    expect(sortSeedsIn('')).toHaveLength(8)
  })

  it('matches a sort column by its label, e.g. "dobra"', () => {
    const suggestions = sortSeedsIn('dobra')
    expect(suggestions.map((entry) => entry.id)).toEqual(['sort:aliada|desc'])
  })

  it('applies a sort suggestion and resets to page 1', () => {
    const applied = applyPeopleOmniboxSuggestion({
      state: parsePeopleListParams({ page: '3', q: 'ana' }),
      suggestionId: 'sort:aliada|desc',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') {
      expect(applied.state).toEqual({ page: 1, q: 'ana', sort: 'aliada', dir: 'desc' })
    }
  })

  it('keeps the full option catalog for the chip label of a header-applied secondary direction', () => {
    const chips = buildPeopleOmniboxChips({
      state: parsePeopleListParams({ sort: 'name', dir: 'desc' }),
      municipalityLabelsById: new Map(),
    })
    expect(chips.some((chip) => chip.id === 'sort' && chip.label === 'Ordenação: Nome (Z–A)')).toBe(
      true,
    )
  })
})

describe('people omnibox — "Qualquer ausência" facet (C125)', () => {
  it('suggests the umbrella absence with the natural "incompleto" keyword', () => {
    const byKeyword = filterPeopleOmniboxSuggestions(seeds, 'incompleto').filter(
      (entry) => entry.group === 'Ausência',
    )
    expect(byKeyword.some((entry) => entry.id === 'ausencia:qualquer_ausencia')).toBe(true)
    expect(byKeyword.map((entry) => entry.id).sort()).toEqual([
      'ausencia:qualquer_ausencia',
      'ausencia:sem_assessor',
      'ausencia:sem_base',
      'ausencia:sem_contato',
    ])

    const byLabel = filterPeopleOmniboxSuggestions(seeds, 'qualquer')
    expect(byLabel.some((entry) => entry.id === 'ausencia:qualquer_ausencia')).toBe(true)
  })

  it('toggles the umbrella value like any other facet value', () => {
    const added = applyPeopleOmniboxSuggestion({
      state: parsePeopleListParams({}),
      suggestionId: 'ausencia:qualquer_ausencia',
    })
    expect(added.kind).toBe('url')
    if (added.kind === 'url') {
      expect(added.state.ausencias).toEqual(['qualquer_ausencia'])
    }

    const removed = removePeopleOmniboxChip({
      state: parsePeopleListParams({ ausencia: 'qualquer_ausencia' }),
      chipId: 'ausencia:qualquer_ausencia',
    })
    expect(removed.kind).toBe('url')
    if (removed.kind === 'url') expect(removed.state.ausencias).toBeUndefined()
  })

  it('renders the umbrella chip with its pt-BR label', () => {
    const chips = buildPeopleOmniboxChips({
      state: parsePeopleListParams({ ausencia: 'qualquer_ausencia' }),
      municipalityLabelsById: new Map(),
    })
    expect(chips.map((chip) => chip.id)).toEqual(['ausencia:qualquer_ausencia'])
    expect(chips[0]?.label).toBe('Ausência: Qualquer ausência')
  })
})
