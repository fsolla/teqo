import { describe, expect, it } from 'vitest'

import {
  buildPeopleDeputySourceWhere,
  buildPeopleLeadershipSourceWhere,
  buildPeopleListHref,
  buildPeopleSortHref,
  buildPeopleStaffSourceWhere,
  parsePeopleListParams,
  resolvePeopleListUrl,
  serializeCanonicalPeopleListSearchParams,
} from '@/utilities/people/peopleListUrl'

describe('people list URL contract', () => {
  it('defaults to page 1 with no filters', () => {
    expect(parsePeopleListParams({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parsePeopleListParams({ page: '4' }).page).toBe(4)
    expect(parsePeopleListParams({ page: '0' }).page).toBe(1)
    expect(parsePeopleListParams({ page: '-2' }).page).toBe(1)
    expect(parsePeopleListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parsePeopleListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parsePeopleListParams({ q: '   ' }).q).toBeUndefined()
    expect(parsePeopleListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses and dedupes known capacity values', () => {
    expect(parsePeopleListParams({ capacity: 'assessora' }).capacities).toEqual(['assessora'])
    expect(
      parsePeopleListParams({ capacity: ['lideranca', 'dobradinha', 'lideranca', 'unknown'] })
        .capacities,
    ).toEqual(['lideranca', 'dobradinha'])
  })

  it('treats selecting every capacity as no filter (canonical "todas")', () => {
    const all = parsePeopleListParams({ capacity: ['assessora', 'lideranca', 'dobradinha'] })
    expect(all.capacities).toBeUndefined()
  })

  it('parses and dedupes integer municipality ids and known status values', () => {
    expect(
      parsePeopleListParams({
        municipality: ['12', '12', '0', 'abc', '3'],
        status: ['engajado', 'em_disputa', 'unknown'],
      }),
    ).toEqual({ page: 1, municipalities: [12, 3], statuses: ['engajado', 'em_disputa'] })
  })

  it('parses known sort keys and directions, dropping anything else', () => {
    expect(parsePeopleListParams({ sort: 'lidera', dir: 'asc' })).toEqual({
      page: 1,
      sort: 'lidera',
      dir: 'asc',
    })
    expect(parsePeopleListParams({ sort: 'email', dir: 'up' })).toEqual({ page: 1 })
    expect(parsePeopleListParams({ sort: 'name' })).toEqual({ page: 1, sort: 'name' })
  })

  it('parses absence facets with OR values, dropping unknown and canonicalizing "todas"', () => {
    expect(parsePeopleListParams({ ausencia: 'sem_contato' })).toEqual({
      page: 1,
      ausencias: ['sem_contato'],
    })
    expect(
      parsePeopleListParams({ ausencia: ['sem_base', 'sem_assessor', 'sem_base', 'nada'] }),
    ).toEqual({ page: 1, ausencias: ['sem_base', 'sem_assessor'] })
    expect(parsePeopleListParams({ ausencia: 'sem_e_mail' })).toEqual({ page: 1 })
    expect(
      parsePeopleListParams({ ausencia: ['sem_assessor', 'sem_base', 'sem_contato'] }),
    ).toEqual({ page: 1 })
  })

  it('canonicalizes selecting every status member to the absent filter (C119)', () => {
    expect(
      parsePeopleListParams({
        status: ['engajado', 'a_abordar', 'em_disputa', 'lembranca', 'negativo'],
      }),
    ).toEqual({ page: 1 })
  })

  it('serializes canonical params in stable order and omits defaults', () => {
    const params = serializeCanonicalPeopleListSearchParams({
      page: 1,
      q: 'ana',
      capacities: ['lideranca'],
      municipalities: [3, 12],
      statuses: ['engajado'],
    })
    expect(params.toString()).toBe(
      'q=ana&capacity=lideranca&municipality=3&municipality=12&status=engajado',
    )
  })

  it('serializes absence and sort params, omitting the default sort', () => {
    expect(
      serializeCanonicalPeopleListSearchParams({
        page: 1,
        ausencias: ['sem_base', 'sem_contato'],
      }).toString(),
    ).toBe('ausencia=sem_base&ausencia=sem_contato')

    expect(
      serializeCanonicalPeopleListSearchParams({ page: 1, sort: 'name', dir: 'asc' }).toString(),
    ).toBe('')

    expect(
      serializeCanonicalPeopleListSearchParams({ page: 1, sort: 'lidera', dir: 'desc' }).toString(),
    ).toBe('sort=lidera')

    expect(
      serializeCanonicalPeopleListSearchParams({ page: 1, sort: 'base', dir: 'desc' }).toString(),
    ).toBe('sort=base&dir=desc')
  })

  it('builds hrefs through the canonical serializer and drops page 1', () => {
    expect(buildPeopleListHref({ page: 1, capacities: ['dobradinha'] }, 1)).toBe(
      '/campanha/pessoas?capacity=dobradinha',
    )
    expect(buildPeopleListHref({ page: 3 }, 3)).toBe('/campanha/pessoas?page=3')
  })

  it('resolves a bare URL to the bare path and rejects unsupported params', () => {
    const resolved = resolvePeopleListUrl({ q: 'ana' })
    expect(resolved.state).toEqual({ page: 1, q: 'ana' })
    expect(resolved.href).toBe('/campanha/pessoas?q=ana')
    expect(resolved.redirectHref).toBeUndefined()

    const unsupported = resolvePeopleListUrl({ q: 'ana', sort: 'email' })
    expect(unsupported.redirectHref).toBe('/campanha/pessoas?q=ana')
  })

  it('canonicalizes a default sort away and keeps a non-default one', () => {
    const defaulted = resolvePeopleListUrl({ q: 'ana', sort: 'name' })
    expect(defaulted.state).toEqual({ page: 1, q: 'ana', sort: 'name' })
    expect(defaulted.redirectHref).toBe('/campanha/pessoas?q=ana')

    const kept = resolvePeopleListUrl({ sort: 'lidera', dir: 'desc' })
    expect(kept.redirectHref).toBe('/campanha/pessoas?sort=lidera')
    expect(kept.href).toBe('/campanha/pessoas?sort=lidera')

    const explicitDir = resolvePeopleListUrl({ sort: 'base', dir: 'desc' })
    expect(explicitDir.href).toBe('/campanha/pessoas?sort=base&dir=desc')

    // A bare dir resolves against the default key and canonicalizes without a loop.
    const bareDir = resolvePeopleListUrl({ dir: 'desc' })
    expect(bareDir.state).toEqual({ page: 1, dir: 'desc' })
    expect(bareDir.redirectHref).toBe('/campanha/pessoas?sort=name&dir=desc')
  })

  it('builds sort-toggle hrefs: flips the active key, applies the new key default, resets to page 1', () => {
    expect(buildPeopleSortHref({ page: 1 }, 'lidera')).toBe('/campanha/pessoas?sort=lidera')
    expect(buildPeopleSortHref({ page: 1, sort: 'lidera', dir: 'desc' }, 'lidera')).toBe(
      '/campanha/pessoas?sort=lidera&dir=asc',
    )
    expect(buildPeopleSortHref({ page: 1, sort: 'lidera', dir: 'desc' }, 'base')).toBe(
      '/campanha/pessoas?sort=base',
    )
    expect(buildPeopleSortHref({ page: 3, sort: 'lidera', dir: 'desc' }, 'base')).toBe(
      '/campanha/pessoas?sort=base',
    )
    expect(buildPeopleSortHref({ page: 1, sort: 'lidera', dir: 'desc' }, 'name')).toBe(
      '/campanha/pessoas',
    )
  })

  it('clamps an out-of-range page to totalPages', () => {
    const resolved = resolvePeopleListUrl({ page: '9' }, 3)
    expect(resolved.state.page).toBe(3)
    expect(resolved.redirectHref).toBe('/campanha/pessoas?page=3')
  })
})

describe('people list source-level wheres', () => {
  it('builds the leadership where from q, statuses and municipalities', () => {
    expect(buildPeopleLeadershipSourceWhere({ page: 1 })).toEqual({})
    expect(
      buildPeopleLeadershipSourceWhere({
        page: 1,
        q: 'ana',
        statuses: ['engajado'],
        municipalities: [3],
      }),
    ).toEqual({
      and: [
        { 'contact.name': { contains: 'ana' } },
        { supportStatus: { in: ['engajado'] } },
        { municipalities: { in: [3] } },
      ],
    })
  })

  it('restricts the deputy where to q only', () => {
    expect(buildPeopleDeputySourceWhere({ page: 1, q: 'ana', statuses: ['engajado'] })).toEqual({
      and: [{ 'contact.name': { contains: 'ana' } }],
    })
  })

  it('always restricts the staff source to staff roles with a ficha', () => {
    expect(buildPeopleStaffSourceWhere({ page: 1 })).toEqual({
      and: [
        { role: { in: ['advisor', 'coordinator', 'candidate'] } },
        { contact: { exists: true } },
      ],
    })
    expect(buildPeopleStaffSourceWhere({ page: 1, q: 'ana' }).and).toContainEqual({
      'contact.name': { contains: 'ana' },
    })
  })
})
