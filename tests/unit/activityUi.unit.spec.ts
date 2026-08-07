import { describe, expect, it } from 'vitest'

import {
  activityTabs,
  buildActivityAgendaHref,
  buildActivityAgendaSearchParams,
  buildActivityAgendaWhere,
  buildActivityCreateHref,
  buildActivityFiltersKey,
  buildActivityListHref,
  buildActivityListSearchParams,
  buildActivityListWhere,
  parseActivityAgendaParams,
  parseActivityAgendaReturnHref,
  parseActivityCreatePrefill,
  parseActivityListParams,
  resolveActivityAgendaUrl,
  resolveActivityListUrl,
  restrictActivityAgendaState,
} from '@/utilities/activityUi'

const NOW = new Date('2026-07-25T12:00:00.000Z')

describe('parseActivityListParams', () => {
  it('defaults to the proximos tab on page 1', () => {
    expect(parseActivityListParams({})).toEqual({ page: 1, tab: 'proximos' })
  })

  it('falls back to proximos on an unknown tab', () => {
    expect(parseActivityListParams({ tab: 'passados' }).tab).toBe('proximos')
  })

  it('accepts every declared tab', () => {
    for (const tab of activityTabs) {
      expect(parseActivityListParams({ tab }).tab).toBe(tab)
    }
  })

  it('honors status only on the todos tab', () => {
    expect(parseActivityListParams({ status: 'realizado' }).status).toBeUndefined()
    expect(parseActivityListParams({ tab: 'todos', status: 'realizado' }).status).toBe('realizado')
    expect(parseActivityListParams({ tab: 'todos', status: 'inexistente' }).status).toBeUndefined()
  })

  it('validates tag and municipality', () => {
    expect(parseActivityListParams({ tag: 'Caminhada' }).tag).toBe('Caminhada')
    expect(parseActivityListParams({ municipality: '12' }).municipality).toBe(12)
    expect(parseActivityListParams({ municipality: '0' }).municipality).toBeUndefined()
  })

  it('parses and trims q', () => {
    expect(parseActivityListParams({ q: '  comício  ' }).q).toBe('comício')
    expect(parseActivityListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseActivityListParams({ q: 'a' }).q).toBeUndefined()
  })
})

describe('buildActivityListWhere (tab → where matrix)', () => {
  it('proximos = confirmado starting from now', () => {
    const where = buildActivityListWhere({ page: 1, tab: 'proximos' }, NOW)
    expect(where).toEqual({
      and: [
        { status: { equals: 'confirmado' } },
        { startAt: { greater_than_equal: NOW.toISOString() } },
      ],
    })
  })

  it('realizados filters by its status', () => {
    expect(buildActivityListWhere({ page: 1, tab: 'realizados' }, NOW)).toEqual({
      and: [{ status: { equals: 'realizado' } }],
    })
  })

  it('todos is unfiltered unless a status is chosen', () => {
    expect(buildActivityListWhere({ page: 1, tab: 'todos' }, NOW)).toEqual({})
    expect(buildActivityListWhere({ page: 1, tab: 'todos', status: 'cancelado' }, NOW)).toEqual({
      and: [{ status: { equals: 'cancelado' } }],
    })
  })

  it('prepends tag and municipality filters on any tab', () => {
    const where = buildActivityListWhere(
      { page: 1, tab: 'realizados', tag: 'Comício', municipality: 3 },
      NOW,
    )
    expect(where).toEqual({
      and: [
        { tags: { contains: 'Comício' } },
        { municipality: { equals: 3 } },
        { status: { equals: 'realizado' } },
      ],
    })
  })

  it('filters by title or responsible name when q is set', () => {
    const where = buildActivityListWhere({ page: 1, tab: 'proximos', q: 'Maria' }, NOW)
    expect(where).toEqual({
      and: [
        {
          or: [{ title: { contains: 'Maria' } }, { 'responsible.name': { contains: 'Maria' } }],
        },
        { status: { equals: 'confirmado' } },
        { startAt: { greater_than_equal: NOW.toISOString() } },
      ],
    })
  })
})

describe('buildActivityListSearchParams', () => {
  it('omits the default tab and page 1', () => {
    expect(buildActivityListSearchParams({ page: 1, tab: 'proximos' }).toString()).toBe('')
    expect(buildActivityListSearchParams({ page: 2, tab: 'todos' }).toString()).toBe(
      'tab=todos&page=2',
    )
  })

  it('serializes filters in canonical order', () => {
    const params = buildActivityListSearchParams({
      page: 1,
      tab: 'todos',
      q: 'comício',
      tag: 'Caminhada',
      status: 'cancelado',
      municipality: 9,
    })
    expect(params.toString()).toBe(
      'q=com%C3%ADcio&tab=todos&tag=Caminhada&status=cancelado&municipality=9',
    )
  })
})

describe('hrefs and canonical URL resolution', () => {
  it('builds hrefs against the atividades base path', () => {
    expect(buildActivityListHref({ page: 1, tab: 'proximos' }, 1)).toBe('/campanha/atividades')
    expect(buildActivityListHref({ page: 1, tab: 'realizados' }, 2)).toBe(
      '/campanha/atividades?tab=realizados&page=2',
    )
  })

  it('derives the filters key from the canonical serialization', () => {
    expect(buildActivityFiltersKey({ page: 1, tab: 'todos', tag: 'Comício' })).toBe(
      'tab=todos&tag=Com%C3%ADcio',
    )
  })

  it('redirects an explicit default tab out of the URL', () => {
    const result = resolveActivityListUrl({ tab: 'proximos' })
    expect(result.href).toBe('/campanha/atividades')
    expect(result.redirectHref).toBe('/campanha/atividades')
  })

  it('redirects on unsupported params and clamps the page', () => {
    expect(resolveActivityListUrl({ foo: 'bar' }).redirectHref).toBe('/campanha/atividades')
    const clamped = resolveActivityListUrl({ tab: 'todos', page: '50' }, 2)
    expect(clamped.state.page).toBe(2)
    expect(clamped.redirectHref).toBe('/campanha/atividades?tab=todos&page=2')
  })
})

describe('activity agenda URL contract', () => {
  it('parses the three agenda filters fail-closed', () => {
    expect(
      parseActivityAgendaParams({
        municipality: '12',
        deputyPresent: '1',
        tag: '  Comício  ',
      }),
    ).toEqual({ municipality: 12, deputyPresent: true, tag: 'Comício' })

    expect(
      parseActivityAgendaParams({ municipality: '0', deputyPresent: 'true', tag: '  ' }),
    ).toEqual({})
  })

  it('serializes agenda filters in one canonical order', () => {
    const state = { municipality: 12, deputyPresent: true as const, tag: 'Comício' }

    expect(buildActivityAgendaSearchParams(state).toString()).toBe(
      'municipality=12&deputyPresent=1&tag=Com%C3%ADcio',
    )
    expect(buildActivityAgendaHref(state)).toBe(
      '/campanha/agenda?municipality=12&deputyPresent=1&tag=Com%C3%ADcio',
    )
  })

  it('canonicalizes invalid and unsupported agenda params', () => {
    expect(
      resolveActivityAgendaUrl({
        municipality: '12',
        deputyPresent: 'true',
        tag: ' Comício ',
        page: '2',
      }).redirectHref,
    ).toBe('/campanha/agenda?municipality=12&tag=Com%C3%ADcio')
  })

  it('drops municipality and tag filters outside the actor accessible options', () => {
    expect(
      restrictActivityAgendaState(
        { municipality: 12, deputyPresent: true, tag: 'Comício' },
        new Set([13]),
        new Set(['Reunião']),
      ),
    ).toEqual({ deputyPresent: true })
  })
})

describe('buildActivityAgendaWhere', () => {
  it('combines visible-range overlap with municipality, deputy and tag filters', () => {
    expect(
      buildActivityAgendaWhere(
        { municipality: 12, deputyPresent: true, tag: 'Comício' },
        '2026-08-03T03:00:00.000Z',
        '2026-08-10T03:00:00.000Z',
      ),
    ).toEqual({
      and: [
        { startAt: { less_than: '2026-08-10T03:00:00.000Z' } },
        {
          or: [
            { endAt: { greater_than: '2026-08-03T03:00:00.000Z' } },
            {
              and: [
                { endAt: { exists: false } },
                { startAt: { greater_than_equal: '2026-08-03T03:00:00.000Z' } },
              ],
            },
          ],
        },
        { municipality: { equals: 12 } },
        { deputyPresent: { equals: true } },
        { tags: { contains: 'Comício' } },
      ],
    })
  })
})

describe('activity create prefill', () => {
  it('carries the canonical agenda return URL into creation', () => {
    expect(
      buildActivityCreateHref(
        { municipality: 12, deputyPresent: true, tag: 'Comício' },
        {
          startAt: '2026-08-07T13:00:00.000Z',
          endAt: '2026-08-07T14:00:00.000Z',
        },
      ),
    ).toBe(
      '/campanha/atividades/nova?startAt=2026-08-07T13%3A00%3A00.000Z&endAt=2026-08-07T14%3A00%3A00.000Z&municipality=12&returnTo=%2Fcampanha%2Fagenda%3Fmunicipality%3D12%26deputyPresent%3D1%26tag%3DCom%25C3%25ADcio',
    )
  })

  it('accepts only accessible canonical agenda return URLs', () => {
    expect(
      parseActivityAgendaReturnHref(
        '/campanha/agenda?municipality=12&deputyPresent=1&tag=Com%C3%ADcio',
        new Set([12]),
        new Set(['Comício']),
      ),
    ).toBe('/campanha/agenda?municipality=12&deputyPresent=1&tag=Com%C3%ADcio')
    expect(
      parseActivityAgendaReturnHref(
        'https://example.com/campanha/agenda?municipality=12',
        new Set([12]),
        new Set(),
      ),
    ).toBe('/campanha/agenda')
  })

  it('normalizes a valid slot and accepts only an accessible municipality', () => {
    expect(
      parseActivityCreatePrefill(
        {
          startAt: '2026-08-07T10:00:00-03:00',
          endAt: '2026-08-07T11:00:00-03:00',
          municipality: '12',
        },
        new Set([12]),
      ),
    ).toEqual({
      startAt: '2026-08-07T13:00:00.000Z',
      endAt: '2026-08-07T14:00:00.000Z',
      municipalityId: 12,
    })
  })

  it('drops an invalid slot and an out-of-scope municipality', () => {
    expect(
      parseActivityCreatePrefill(
        {
          startAt: 'sexta de manhã',
          endAt: '2026-08-07T11:00:00-03:00',
          municipality: '99',
        },
        new Set([12]),
      ),
    ).toEqual({})
  })

  it('keeps a valid start but drops an inverted end', () => {
    expect(
      parseActivityCreatePrefill(
        {
          startAt: '2026-08-07T10:00:00-03:00',
          endAt: '2026-08-07T09:00:00-03:00',
        },
        new Set(),
      ),
    ).toEqual({ startAt: '2026-08-07T13:00:00.000Z' })
  })
})
