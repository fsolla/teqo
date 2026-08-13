import { describe, expect, it } from 'vitest'

import {
  buildContactFilterHref,
  clearContactListFilters,
  contactAbsenceFilterOptions,
  contactGenderFilterOptions,
  contactStateFilterOptions,
  contactVinculoFilterOptions,
  toggleContactAbsenceFilter,
  toggleContactCityFilter,
  toggleContactGenderFilter,
  toggleContactStateFilter,
  toggleContactVinculoFilter,
} from '@/utilities/contacts/contactListFilters'
import { parseContactListParams } from '@/utilities/contacts/contactListUrl'
import {
  applyContactOmniboxSuggestion,
  buildContactOmniboxChips,
  buildContactOmniboxSuggestionSeeds,
  filterContactOmniboxSuggestions,
  removeContactOmniboxChip,
} from '@/utilities/contacts/contactOmnibox'

describe('contacts list filter affordances', () => {
  it('offers the static seeds: 4 genders, 27 states, 2 absences, 4 vinculos', () => {
    expect(contactGenderFilterOptions.map((option) => option.value)).toEqual([
      'feminino',
      'masculino',
      'outro',
      'nao_informado',
    ])
    expect(contactStateFilterOptions).toHaveLength(27)
    expect(contactStateFilterOptions[0]).toEqual({ value: 'AC', label: 'AC' })
    expect(contactAbsenceFilterOptions.map((option) => option.value)).toEqual([
      'sem_telefone',
      'sem_email',
    ])
    expect(contactVinculoFilterOptions.map((option) => option.value)).toEqual([
      'liderancas',
      'dobradinhas',
      'assessores',
      'equipe',
    ])
  })

  it('toggles gender and state, validating the value', () => {
    const base = parseContactListParams({})
    expect(toggleContactGenderFilter(base, 'feminino')).toEqual({
      page: 1,
      genders: ['feminino'],
    })
    expect(toggleContactGenderFilter(base, 'unknown')).toEqual(base)
    const withGender = toggleContactGenderFilter(base, 'feminino')
    expect(toggleContactGenderFilter(withGender, 'feminino')).toEqual(base)
    expect(toggleContactStateFilter(base, 'BA').states).toEqual(['BA'])
    expect(toggleContactStateFilter(base, 'XX')).toEqual(base)
  })

  it('toggles absence and vinculo as real ORs (never a no-op umbrella)', () => {
    const base = parseContactListParams({})
    const bothAbsences = toggleContactAbsenceFilter(
      toggleContactAbsenceFilter(base, 'sem_telefone'),
      'sem_email',
    )
    expect(bothAbsences.ausencias).toEqual(['sem_telefone', 'sem_email'])
    expect(toggleContactAbsenceFilter(base, 'nope')).toEqual(base)
    const bothVinculos = toggleContactVinculoFilter(
      toggleContactVinculoFilter(base, 'liderancas'),
      'equipe',
    )
    expect(bothVinculos.vinculos).toEqual(['liderancas', 'equipe'])
    expect(toggleContactVinculoFilter(base, 'nope')).toEqual(base)
  })

  it('toggles city as free text with structural validation', () => {
    const base = parseContactListParams({})
    expect(toggleContactCityFilter(base, '  Feira de Santana  ').cities).toEqual([
      'Feira de Santana',
    ])
    expect(toggleContactCityFilter(base, '   ')).toEqual(base)
    expect(toggleContactCityFilter(base, 'x'.repeat(101))).toEqual(base)
  })

  it('clears filters keeping the sort, and builds filter hrefs pinned to page 1', () => {
    const filtered = parseContactListParams({
      q: 'ana',
      gender: 'feminino',
      state: 'BA',
      city: 'Feira de Santana',
      ausencia: 'sem_email',
      vinculo: 'liderancas',
      sort: 'cidade',
      dir: 'desc',
      page: '3',
    })
    const cleared = clearContactListFilters(filtered)
    expect(cleared).toEqual({ page: 1, sort: 'cidade', dir: 'desc' })
    expect(buildContactFilterHref(cleared)).toContain('sort=cidade')
    expect(buildContactFilterHref(cleared)).toContain('dir=desc')
    // Canonical hrefs omit default page=1, so a filtered href never carries
    // a page param at all — filters always land back on page 1.
    expect(buildContactFilterHref(filtered)).not.toContain('page=')
  })
})

describe('contacts list omnibox adapter', () => {
  it('builds one chip per active filter dimension', () => {
    const state = parseContactListParams({
      q: 'ana',
      gender: 'feminino',
      state: ['BA', 'SP'],
      city: 'Feira de Santana',
      ausencia: 'sem_telefone',
      vinculo: 'liderancas',
      sort: 'cidade',
      dir: 'desc',
    })
    const chips = buildContactOmniboxChips(state)
    expect(chips.map((chip) => chip.id)).toEqual([
      'q',
      'gender:feminino',
      'state:BA',
      'state:SP',
      'city:Feira de Santana',
      'ausencia:sem_telefone',
      'vinculo:liderancas',
      'sort',
    ])
    expect(chips[0]).toEqual({ id: 'q', label: 'Busca: ana' })
    expect(chips[1]).toEqual({ id: 'gender:feminino', label: 'Gênero: Feminino' })
  })

  it('omits the sort chip on the default sort', () => {
    const chips = buildContactOmniboxChips(parseContactListParams({ q: 'ana' }))
    expect(chips.map((chip) => chip.id)).toEqual(['q'])
  })

  it('filters suggestions by group, label and keyword, capping per group', () => {
    const seeds = buildContactOmniboxSuggestionSeeds({
      cityFilterOptions: [
        { value: 'Feira de Santana', label: 'Feira de Santana' },
        { value: 'Salvador', label: 'Salvador' },
      ],
    })
    const byLabel = filterContactOmniboxSuggestions(seeds, 'Salvador')
    expect(byLabel.map((suggestion) => suggestion.id)).toContain('city:Salvador')
    const byKeyword = filterContactOmniboxSuggestions(seeds, 'genero')
    // The omnibox always surfaces the q suggestion for a non-empty query
    // (group 'Busca'); the keyword-matched seeds are the Gênero shortcuts.
    expect(byKeyword.some((suggestion) => suggestion.group === 'Busca')).toBe(true)
    const genderMatches = byKeyword.filter((suggestion) => suggestion.group === 'Gênero')
    expect(genderMatches.map((suggestion) => suggestion.id)).toEqual([
      'gender:feminino',
      'gender:masculino',
      'gender:outro',
      'gender:nao_informado',
    ])
    const emptyQuery = filterContactOmniboxSuggestions(seeds, '')
    // Empty query shows only the dimension shortcuts; data-driven city seeds are hidden.
    expect(emptyQuery.some((suggestion) => suggestion.id.startsWith('city:'))).toBe(false)
    expect(emptyQuery.some((suggestion) => suggestion.group === 'Ordenação')).toBe(true)
  })

  it('applies suggestions: q, facets (toggle), sort (with default collapse)', () => {
    const base = parseContactListParams({})
    expect(applyContactOmniboxSuggestion({ state: base, suggestionId: 'q:ana' })).toEqual({
      kind: 'url',
      state: { page: 1, q: 'ana' },
    })
    expect(applyContactOmniboxSuggestion({ state: base, suggestionId: 'gender:feminino' })).toEqual(
      { kind: 'url', state: { page: 1, genders: ['feminino'] } },
    )
    const sortApplied = applyContactOmniboxSuggestion({
      state: base,
      suggestionId: 'sort:cidade|desc',
    })
    expect(sortApplied).toEqual({
      kind: 'url',
      state: { page: 1, sort: 'cidade', dir: 'desc' },
    })
    const sortToggled = applyContactOmniboxSuggestion({
      state: { page: 1, sort: 'cidade', dir: 'desc' },
      suggestionId: 'sort:cidade|desc',
    })
    expect(sortToggled).toEqual({ kind: 'url', state: { page: 1, sort: 'cidade', dir: 'desc' } })
  })

  it('removes chips by id and clears everything preserving the sort', () => {
    const state = parseContactListParams({
      q: 'ana',
      gender: 'feminino',
      city: 'Salvador',
      sort: 'cidade',
    })
    const removed = removeContactOmniboxChip({ state, chipId: 'city:Salvador' })
    expect(removed).toEqual({
      kind: 'url',
      state: { page: 1, q: 'ana', genders: ['feminino'], sort: 'cidade' },
    })
    const cleared = applyContactOmniboxSuggestion({ state, suggestionId: 'clear:all' })
    expect(cleared.kind).toBe('url')
  })
})
