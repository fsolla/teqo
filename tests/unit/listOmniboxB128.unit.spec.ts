import { describe, expect, it } from 'vitest'

import {
  applySearchOnlyOmniboxSuggestion,
  buildSearchOnlyOmniboxChips,
  buildSearchOnlyOmniboxSuggestions,
  clearSearchOnlyOmnibox,
  removeSearchOnlyOmniboxChip,
} from '@/lib/searchOnlyListOmnibox'
import {
  applyActivityOmniboxSuggestion,
  buildActivityOmniboxChips,
  buildActivityOmniboxSuggestionSeeds,
  clearActivityOmnibox,
  filterActivityOmniboxSuggestions,
  removeActivityOmniboxChip,
} from '@/utilities/activityOmnibox'
import { parseActivityListParams } from '@/utilities/activityUi'
import { parseAdvisorListParams } from '@/utilities/advisor/advisorListUrl'
import {
  applyAdvisorOmniboxSuggestion,
  buildAdvisorOmniboxChips,
  buildAdvisorOmniboxSuggestionSeeds,
  filterAdvisorOmniboxSuggestions,
} from '@/utilities/advisor/advisorOmnibox'
import { parseDemandListParams } from '@/utilities/demand/demandListUrl'
import {
  applyDemandOmniboxSuggestion,
  buildDemandOmniboxChips,
  clearDemandOmnibox,
} from '@/utilities/demand/demandOmnibox'
import { parseLeadershipListParams } from '@/utilities/leadership/leadershipListUrl'
import {
  applyLeadershipOmniboxSuggestion,
  buildLeadershipOmniboxSuggestionSeeds,
  filterLeadershipOmniboxSuggestions,
} from '@/utilities/leadership/leadershipOmnibox'
import { parseOrganizationListParams } from '@/utilities/organization/organizationListUrl'
import {
  applyOrganizationOmniboxSuggestion,
  buildOrganizationOmniboxChips,
  buildOrganizationOmniboxSuggestionSeeds,
  clearOrganizationOmnibox,
  filterOrganizationOmniboxSuggestions,
  removeOrganizationOmniboxChip,
} from '@/utilities/organization/organizationOmnibox'
import { parseStateDeputyListParams } from '@/utilities/stateDeputyListUrl'
import {
  applyStateDeputyOmniboxSuggestion,
  buildStateDeputyOmniboxChips,
} from '@/utilities/stateDeputyOmnibox'
import {
  applySupporterOmniboxSuggestion,
  buildSupporterOmniboxChips,
} from '@/utilities/supporter/supporterOmnibox'
import { parseSupporterListParams } from '@/utilities/supporter/supporterUi'
import { parseTerritoryListParams } from '@/utilities/territory/territoryListUrl'
import {
  applyTerritoryOmniboxSuggestion,
  buildTerritoryOmniboxChips,
  buildTerritoryOmniboxSuggestionSeeds,
  filterTerritoryOmniboxSuggestions,
} from '@/utilities/territory/territoryOmnibox'

describe('list omnibox adapters (B128)', () => {
  it('territory builds chips and applies search', () => {
    const state = parseTerritoryListParams({ q: 'rec', region: 'Recôncavo' })
    const chips = buildTerritoryOmniboxChips(state)
    expect(chips.some((chip) => chip.id === 'q')).toBe(true)
    expect(chips.some((chip) => chip.id === 'region:Recôncavo')).toBe(true)

    const applied = applyTerritoryOmniboxSuggestion({ state, suggestionId: 'q:Salvador' })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') expect(applied.state.q).toBe('Salvador')
  })

  it('territory suggests sort when typing ordenar', () => {
    const seeds = buildTerritoryOmniboxSuggestionSeeds([])
    const suggestions = filterTerritoryOmniboxSuggestions(seeds, 'ordenar')
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
  })

  it('leadership applies status toggle and builds chips', () => {
    const base = parseLeadershipListParams({})
    const applied = applyLeadershipOmniboxSuggestion({
      state: base,
      suggestionId: 'status:engajado',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') {
      expect(applied.state.statuses).toContain('engajado')
    }

    const seeds = buildLeadershipOmniboxSuggestionSeeds({
      municipalityFilterOptions: [],
      organizationFilterOptions: [],
      stateDeputyFilterOptions: [],
    })
    const suggestions = filterLeadershipOmniboxSuggestions(seeds, 'ordenar')
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
  })

  it('leadership applies organization and stateDeputy toggles', () => {
    const base = parseLeadershipListParams({})
    const organization = applyLeadershipOmniboxSuggestion({
      state: base,
      suggestionId: 'organization:12',
    })
    expect(organization.kind).toBe('url')
    if (organization.kind === 'url') {
      expect(organization.state.organizations).toEqual([12])
    }

    const stateDeputy = applyLeadershipOmniboxSuggestion({
      state: base,
      suggestionId: 'stateDeputy:7',
    })
    expect(stateDeputy.kind).toBe('url')
    if (stateDeputy.kind === 'url') {
      expect(stateDeputy.state.stateDeputies).toEqual([7])
    }
  })

  it('state deputy toggles party filter', () => {
    const base = parseStateDeputyListParams({})
    const applied = applyStateDeputyOmniboxSuggestion({
      state: base,
      suggestionId: 'party:PT',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') expect(applied.state.parties).toEqual(['PT'])

    const chips = buildStateDeputyOmniboxChips(
      parseStateDeputyListParams({ q: 'joão', party: 'PT' }),
    )
    expect(chips.map((chip) => chip.id)).toEqual(['q', 'party:PT'])
  })

  it('supporter applies vote intention exclusively', () => {
    const base = parseSupporterListParams({})
    const applied = applySupporterOmniboxSuggestion({
      state: base,
      suggestionId: 'voteIntention:certo',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') expect(applied.state.voteIntention).toBe('certo')

    const chips = buildSupporterOmniboxChips({
      state: parseSupporterListParams({ voteIntention: 'indeciso' }),
      municipalityLabelsById: new Map(),
    })
    expect(chips[0]?.id).toBe('voteIntention:indeciso')
  })

  it('supporter applies source exclusively and builds chips', () => {
    const base = parseSupporterListParams({})
    const applied = applySupporterOmniboxSuggestion({
      state: base,
      suggestionId: 'source:import_csv',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') expect(applied.state.source).toBe('import_csv')

    const toggled = applySupporterOmniboxSuggestion({
      state: parseSupporterListParams({ source: 'import_csv' }),
      suggestionId: 'source:import_csv',
    })
    expect(toggled.kind).toBe('url')
    if (toggled.kind === 'url') expect(toggled.state.source).toBeUndefined()

    const chips = buildSupporterOmniboxChips({
      state: parseSupporterListParams({ source: 'lideranca' }),
      municipalityLabelsById: new Map(),
    })
    expect(chips[0]?.id).toBe('source:lideranca')
    expect(chips[0]?.label).toContain('Liderança')
  })

  it('activity clears filters but keeps tab', () => {
    const state = parseActivityListParams({ tab: 'todos', kind: 'comicio', status: 'planejado' })
    const chips = buildActivityOmniboxChips({ state, municipalityLabelsById: new Map() })
    expect(chips.length).toBeGreaterThan(0)

    const cleared = clearActivityOmnibox(state)
    expect(cleared.kind).toBe('clear')
    if (cleared.kind === 'clear') {
      expect(cleared.state.tab).toBe('todos')
      expect(cleared.state.kind).toBeUndefined()
    }

    const applied = applyActivityOmniboxSuggestion({ state, suggestionId: 'kind:comicio' })
    expect(applied.kind).toBe('url')
  })

  it('activity applies window preset and search (B138)', () => {
    const base = parseActivityListParams({})
    const seeds = buildActivityOmniboxSuggestionSeeds({ tab: base.tab, municipalityOptions: [] })
    const suggestions = filterActivityOmniboxSuggestions(seeds, 'realizados')
    expect(suggestions.some((entry) => entry.id === 'tab:realizados')).toBe(true)

    const tabApplied = applyActivityOmniboxSuggestion({
      state: base,
      suggestionId: 'tab:realizados',
    })
    expect(tabApplied.kind).toBe('url')
    if (tabApplied.kind === 'url') expect(tabApplied.state.tab).toBe('realizados')

    const searchApplied = applyActivityOmniboxSuggestion({
      state: parseActivityListParams({ tab: 'todos', status: 'planejado' }),
      suggestionId: 'q:comício',
    })
    expect(searchApplied.kind).toBe('url')
    if (searchApplied.kind === 'url') {
      expect(searchApplied.state.q).toBe('comício')
      expect(searchApplied.state.status).toBe('planejado')
    }

    const leavingTodos = applyActivityOmniboxSuggestion({
      state: parseActivityListParams({ tab: 'todos', status: 'planejado' }),
      suggestionId: 'tab:realizados',
    })
    if (leavingTodos.kind === 'url') expect(leavingTodos.state.status).toBeUndefined()

    const chips = buildActivityOmniboxChips({
      state: parseActivityListParams({ tab: 'realizados', q: 'Maria' }),
      municipalityLabelsById: new Map(),
    })
    expect(chips.map((chip) => chip.id)).toEqual(['q', 'tab:realizados'])

    const removedTab = removeActivityOmniboxChip({
      state: parseActivityListParams({ tab: 'realizados' }),
      chipId: 'tab:realizados',
    })
    if (removedTab.kind === 'url') expect(removedTab.state.tab).toBe('proximos')
  })

  it('demand toggles exclusive status, kind and search; preserves activity on clear', () => {
    const state = parseDemandListParams({
      status: 'aberta',
      kind: 'material',
      q: 'banner',
      activity: '42',
    })
    const chips = buildDemandOmniboxChips(state)
    expect(chips.map((chip) => chip.id)).toEqual(['q', 'kind:material', 'status:aberta'])

    const toggledStatus = applyDemandOmniboxSuggestion({ state, suggestionId: 'status:aberta' })
    expect(toggledStatus.kind).toBe('url')
    if (toggledStatus.kind === 'url') expect(toggledStatus.state.status).toBeUndefined()

    const toggledKind = applyDemandOmniboxSuggestion({ state, suggestionId: 'kind:transporte' })
    if (toggledKind.kind === 'url') expect(toggledKind.state.kind).toBe('transporte')

    const search = applyDemandOmniboxSuggestion({ state, suggestionId: 'q:comitê' })
    if (search.kind === 'url') expect(search.state.q).toBe('comitê')

    const cleared = clearDemandOmnibox(state)
    if (cleared.kind === 'clear') {
      expect(cleared.state.activityId).toBe(42)
      expect(cleared.state.kind).toBeUndefined()
      expect(cleared.state.status).toBeUndefined()
      expect(cleared.state.q).toBeUndefined()
    }
  })

  it('organization toggles exclusive kind and coexists with search', () => {
    const base = parseOrganizationListParams({})
    const applied = applyOrganizationOmniboxSuggestion({
      state: base,
      suggestionId: 'kind:sindicato',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') expect(applied.state.kind).toBe('sindicato')

    const toggled = applyOrganizationOmniboxSuggestion({
      state: parseOrganizationListParams({ kind: 'sindicato' }),
      suggestionId: 'kind:sindicato',
    })
    if (toggled.kind === 'url') expect(toggled.state.kind).toBeUndefined()

    const chips = buildOrganizationOmniboxChips(
      parseOrganizationListParams({ q: 'cut', kind: 'associacao' }),
    )
    expect(chips.map((chip) => chip.id)).toEqual(['q', 'kind:associacao'])

    const seeds = buildOrganizationOmniboxSuggestionSeeds()
    const suggestions = filterOrganizationOmniboxSuggestions(seeds, 'sindicato')
    expect(suggestions.some((entry) => entry.id === 'kind:sindicato')).toBe(true)

    const removed = removeOrganizationOmniboxChip({
      state: parseOrganizationListParams({ q: 'cut', kind: 'movimento' }),
      chipId: 'kind:movimento',
    })
    if (removed.kind === 'url') {
      expect(removed.state.kind).toBeUndefined()
      expect(removed.state.q).toBe('cut')
    }

    const cleared = clearOrganizationOmnibox(parseOrganizationListParams({ q: 'x', kind: 'outro' }))
    if (cleared.kind === 'clear') {
      expect(cleared.state).toEqual({ page: 1 })
    }
  })

  it('search-only omnibox commits q', () => {
    const chips = buildSearchOnlyOmniboxChips({ q: 'sindicato' })
    expect(chips[0]?.label).toBe('Busca: sindicato')

    const applied = applySearchOnlyOmniboxSuggestion({
      state: { page: 2 },
      suggestionId: 'q:ana',
      withPageReset: (next) => ({ ...next, page: 1 }),
    })
    expect(applied).toEqual({ kind: 'url', state: { page: 1, q: 'ana' } })

    expect(buildSearchOnlyOmniboxSuggestions('x')[0]?.id).toBe('q:x')

    const removed = removeSearchOnlyOmniboxChip({
      state: { q: 'sindicato', page: 2 },
      chipId: 'q',
      withPageReset: (next) => ({ ...next, page: 1 }),
    })
    expect(removed).toEqual({ kind: 'url', state: { page: 1, q: undefined } })

    const cleared = clearSearchOnlyOmnibox({
      state: { q: 'sindicato' },
      cleared: {},
    })
    expect(cleared).toEqual({ kind: 'clear', state: {} })
  })

  it('advisor toggles municipality portfolio filter and suggests by name', () => {
    const base = parseAdvisorListParams({})
    const applied = applyAdvisorOmniboxSuggestion({
      state: base,
      suggestionId: 'municipality:42',
    })
    expect(applied.kind).toBe('url')
    if (applied.kind === 'url') {
      expect(applied.state.municipalities).toEqual([42])
    }

    const chips = buildAdvisorOmniboxChips({
      state: parseAdvisorListParams({ municipality: '42' }),
      municipalityLabelsById: new Map([[42, 'Feira de Santana']]),
    })
    expect(chips[0]?.label).toContain('Feira de Santana')

    const seeds = buildAdvisorOmniboxSuggestionSeeds({
      municipalityFilterOptions: [{ value: '42', label: 'Feira de Santana' }],
    })
    const suggestions = filterAdvisorOmniboxSuggestions(seeds, 'feira')
    expect(suggestions.some((entry) => entry.group === 'Município (carteira)')).toBe(true)
  })
})
