import { describe, expect, it } from 'vitest'

import {
  applySearchOnlyOmniboxSuggestion,
  buildSearchOnlyOmniboxChips,
} from '@/lib/searchOnlyListOmnibox'
import {
  applyActivityOmniboxSuggestion,
  buildActivityOmniboxChips,
  clearActivityOmnibox,
} from '@/utilities/activityOmnibox'
import { parseActivityListParams } from '@/utilities/activityUi'
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

    const seeds = buildLeadershipOmniboxSuggestionSeeds({ municipalityFilterOptions: [] })
    const suggestions = filterLeadershipOmniboxSuggestions(seeds, 'ordenar')
    expect(suggestions.some((entry) => entry.group === 'Ordenação')).toBe(true)
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

  it('demand toggles exclusive status and preserves deep-link fields on clear', () => {
    const state = parseDemandListParams({ status: 'aberta', activity: '42' })
    const chips = buildDemandOmniboxChips(state)
    expect(chips[0]?.label).toContain('Aberta')

    const toggled = applyDemandOmniboxSuggestion({ state, suggestionId: 'status:aberta' })
    expect(toggled.kind).toBe('url')
    if (toggled.kind === 'url') expect(toggled.state.status).toBeUndefined()

    const cleared = clearDemandOmnibox(state)
    if (cleared.kind === 'clear') expect(cleared.state.activityId).toBe(42)
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
  })
})
