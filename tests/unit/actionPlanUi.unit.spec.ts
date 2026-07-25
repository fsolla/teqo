import { describe, expect, it } from 'vitest'

import {
  actionPlanTabs,
  buildActionPlanFiltersKey,
  buildActionPlanListHref,
  buildActionPlanListSearchParams,
  buildActionPlanListWhere,
  parseActionPlanListParams,
  resolveActionPlanListUrl,
} from '@/utilities/actionPlanUi'

const NOW = new Date('2026-07-25T12:00:00.000Z')

describe('parseActionPlanListParams', () => {
  it('defaults to the proximos tab on page 1', () => {
    expect(parseActionPlanListParams({})).toEqual({ page: 1, tab: 'proximos' })
  })

  it('falls back to proximos on an unknown tab', () => {
    expect(parseActionPlanListParams({ tab: 'passados' }).tab).toBe('proximos')
  })

  it('accepts every declared tab', () => {
    for (const tab of actionPlanTabs) {
      expect(parseActionPlanListParams({ tab }).tab).toBe(tab)
    }
  })

  it('honors status only on the todos tab', () => {
    expect(parseActionPlanListParams({ status: 'realizado' }).status).toBeUndefined()
    expect(parseActionPlanListParams({ tab: 'todos', status: 'realizado' }).status).toBe(
      'realizado',
    )
    expect(parseActionPlanListParams({ tab: 'todos', status: 'inexistente' }).status).toBeUndefined()
  })

  it('validates kind and municipality', () => {
    expect(parseActionPlanListParams({ kind: 'caminhada' }).kind).toBe('caminhada')
    expect(parseActionPlanListParams({ kind: 'festa' }).kind).toBeUndefined()
    expect(parseActionPlanListParams({ municipality: '12' }).municipality).toBe(12)
    expect(parseActionPlanListParams({ municipality: '0' }).municipality).toBeUndefined()
  })
})

describe('buildActionPlanListWhere (tab → where matrix)', () => {
  it('proximos = planejado/confirmado starting from now', () => {
    const where = buildActionPlanListWhere({ page: 1, tab: 'proximos' }, NOW)
    expect(where).toEqual({
      and: [
        { status: { in: ['planejado', 'confirmado'] } },
        { startAt: { greater_than_equal: NOW.toISOString() } },
      ],
    })
  })

  it('realizados and rascunhos filter by their status', () => {
    expect(buildActionPlanListWhere({ page: 1, tab: 'realizados' }, NOW)).toEqual({
      and: [{ status: { equals: 'realizado' } }],
    })
    expect(buildActionPlanListWhere({ page: 1, tab: 'rascunhos' }, NOW)).toEqual({
      and: [{ status: { equals: 'rascunho' } }],
    })
  })

  it('todos is unfiltered unless a status is chosen', () => {
    expect(buildActionPlanListWhere({ page: 1, tab: 'todos' }, NOW)).toEqual({})
    expect(buildActionPlanListWhere({ page: 1, tab: 'todos', status: 'cancelado' }, NOW)).toEqual({
      and: [{ status: { equals: 'cancelado' } }],
    })
  })

  it('prepends kind and municipality filters on any tab', () => {
    const where = buildActionPlanListWhere(
      { page: 1, tab: 'realizados', kind: 'comicio', municipality: 3 },
      NOW,
    )
    expect(where).toEqual({
      and: [
        { kind: { equals: 'comicio' } },
        { municipality: { equals: 3 } },
        { status: { equals: 'realizado' } },
      ],
    })
  })
})

describe('buildActionPlanListSearchParams', () => {
  it('omits the default tab and page 1', () => {
    expect(buildActionPlanListSearchParams({ page: 1, tab: 'proximos' }).toString()).toBe('')
    expect(buildActionPlanListSearchParams({ page: 2, tab: 'todos' }).toString()).toBe(
      'tab=todos&page=2',
    )
  })

  it('serializes filters in canonical order', () => {
    const params = buildActionPlanListSearchParams({
      page: 1,
      tab: 'todos',
      kind: 'caminhada',
      status: 'cancelado',
      municipality: 9,
    })
    expect(params.toString()).toBe('tab=todos&kind=caminhada&status=cancelado&municipality=9')
  })
})

describe('hrefs and canonical URL resolution', () => {
  it('builds hrefs against the planos base path', () => {
    expect(buildActionPlanListHref({ page: 1, tab: 'proximos' }, 1)).toBe('/campanha/planos')
    expect(buildActionPlanListHref({ page: 1, tab: 'realizados' }, 2)).toBe(
      '/campanha/planos?tab=realizados&page=2',
    )
  })

  it('derives the filters key from the canonical serialization', () => {
    expect(buildActionPlanFiltersKey({ page: 1, tab: 'todos', kind: 'comicio' })).toBe(
      'tab=todos&kind=comicio',
    )
  })

  it('redirects an explicit default tab out of the URL', () => {
    const result = resolveActionPlanListUrl({ tab: 'proximos' })
    expect(result.href).toBe('/campanha/planos')
    expect(result.redirectHref).toBe('/campanha/planos')
  })

  it('redirects on unsupported params and clamps the page', () => {
    expect(resolveActionPlanListUrl({ foo: 'bar' }).redirectHref).toBe('/campanha/planos')
    const clamped = resolveActionPlanListUrl({ tab: 'todos', page: '50' }, 2)
    expect(clamped.state.page).toBe(2)
    expect(clamped.redirectHref).toBe('/campanha/planos?tab=todos&page=2')
  })
})
