import { describe, expect, it } from 'vitest'

import {
  buildContactListHref,
  buildContactListWhere,
  buildContactSortHref,
  contactListSortPrimaryOptions,
  defaultContactListSortDir,
  parseContactListParams,
  resolveContactListUrl,
  serializeCanonicalContactListSearchParams,
} from '@/utilities/contacts/contactListUrl'

describe('contacts list URL contract', () => {
  it('defaults to page 1 with no filters', () => {
    expect(parseContactListParams({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parseContactListParams({ page: '4' }).page).toBe(4)
    expect(parseContactListParams({ page: '0' }).page).toBe(1)
    expect(parseContactListParams({ page: '-2' }).page).toBe(1)
    expect(parseContactListParams({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parseContactListParams({ q: '  ana  ' }).q).toBe('ana')
    expect(parseContactListParams({ q: '   ' }).q).toBeUndefined()
    expect(parseContactListParams({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses and dedupes known gender and state values', () => {
    expect(parseContactListParams({ gender: 'feminino' })).toEqual({
      page: 1,
      genders: ['feminino'],
    })
    expect(
      parseContactListParams({ gender: ['masculino', 'outro', 'masculino', 'unknown'] }).genders,
    ).toEqual(['masculino', 'outro'])
    expect(parseContactListParams({ state: 'BA' }).states).toEqual(['BA'])
    expect(parseContactListParams({ state: ['BA', 'SP', 'BA', 'XX', 'bA'] }).states).toEqual([
      'BA',
      'SP',
    ])
  })

  it('parses cities as deduped free text up to a sanity cap', () => {
    expect(parseContactListParams({ city: ['Salvador', 'salvador', ' '] }).cities).toEqual([
      'Salvador',
      'salvador',
    ])
    expect(parseContactListParams({ city: ['x'.repeat(101)] }).cities).toBeUndefined()
  })

  it('parses absence facets as OR values, dropping unknown (no "todas" collapse)', () => {
    expect(parseContactListParams({ ausencia: 'sem_telefone' })).toEqual({
      page: 1,
      ausencias: ['sem_telefone'],
    })
    expect(
      parseContactListParams({ ausencia: ['sem_telefone', 'sem_email', 'sem_telefone', 'nada'] })
        .ausencias,
    ).toEqual(['sem_telefone', 'sem_email'])
    // C139 — selecting every absence still filters (fichas sem telefone E sem
    // e-mail): no canonical "todas" collapse for this facet.
    expect(parseContactListParams({ ausencia: ['sem_telefone', 'sem_email'] }).ausencias).toEqual([
      'sem_telefone',
      'sem_email',
    ])
  })

  it('parses vínculo facets as OR values, dropping unknown', () => {
    expect(parseContactListParams({ vinculo: 'liderancas' })).toEqual({
      page: 1,
      vinculos: ['liderancas'],
    })
    expect(
      parseContactListParams({ vinculo: ['dobradinhas', 'equipe', 'dobradinhas', 'nada'] })
        .vinculos,
    ).toEqual(['dobradinhas', 'equipe'])
  })

  it('parses known sort keys and directions, dropping anything else', () => {
    expect(parseContactListParams({ sort: 'cidade', dir: 'asc' })).toEqual({
      page: 1,
      sort: 'cidade',
      dir: 'asc',
    })
    expect(parseContactListParams({ sort: 'party', dir: 'up' })).toEqual({ page: 1 })
    expect(parseContactListParams({ sort: 'name' })).toEqual({ page: 1, sort: 'name' })
    expect(parseContactListParams({ sort: 'party' })).toEqual({ page: 1 })
    expect(parseContactListParams({ dir: 'desc' })).toEqual({ page: 1, dir: 'desc' })
  })

  it('serializes canonical params in stable order and omits defaults', () => {
    expect(
      serializeCanonicalContactListSearchParams({
        page: 1,
        q: 'ana',
        genders: ['feminino'],
        states: ['BA'],
        cities: ['Salvador'],
        ausencias: ['sem_email'],
        vinculos: ['liderancas'],
      }).toString(),
    ).toBe('q=ana&gender=feminino&state=BA&city=Salvador&ausencia=sem_email&vinculo=liderancas')

    expect(
      serializeCanonicalContactListSearchParams({ page: 1, sort: 'name', dir: 'asc' }).toString(),
    ).toBe('')
    expect(
      serializeCanonicalContactListSearchParams({
        page: 1,
        sort: 'cidade',
        dir: 'desc',
      }).toString(),
    ).toBe('sort=cidade&dir=desc')
    expect(serializeCanonicalContactListSearchParams({ page: 3, q: 'ana' }).toString()).toBe(
      'q=ana&page=3',
    )
  })

  it('builds hrefs through the canonical serializer and drops page 1', () => {
    expect(buildContactListHref({ page: 1, vinculos: ['dobradinhas'] }, 1)).toBe(
      '/campanha/contatos?vinculo=dobradinhas',
    )
    expect(buildContactListHref({ page: 3 }, 3)).toBe('/campanha/contatos?page=3')
  })

  it('resolves a bare URL to the bare path and rejects unsupported params', () => {
    const resolved = resolveContactListUrl({ q: 'ana' })
    expect(resolved.state).toEqual({ page: 1, q: 'ana' })
    expect(resolved.href).toBe('/campanha/contatos?q=ana')
    expect(resolved.redirectHref).toBeUndefined()

    const unsupported = resolveContactListUrl({ q: 'ana', party: 'PT' })
    expect(unsupported.redirectHref).toBe('/campanha/contatos?q=ana')
  })

  it('canonicalizes a default sort away and keeps a non-default one', () => {
    const defaulted = resolveContactListUrl({ q: 'ana', sort: 'name' })
    expect(defaulted.state).toEqual({ page: 1, q: 'ana', sort: 'name' })
    expect(defaulted.redirectHref).toBe('/campanha/contatos?q=ana')

    // Every contacts key defaults to asc, so a non-default dir IS canonical
    // (no redirect) — unlike people, whose 'lidera' default is desc.
    const kept = resolveContactListUrl({ sort: 'cidade', dir: 'desc' })
    expect(kept.redirectHref).toBeUndefined()
    expect(kept.href).toBe('/campanha/contatos?sort=cidade&dir=desc')

    // A bare dir resolves against the default key and canonicalizes without a loop.
    const bareDir = resolveContactListUrl({ dir: 'desc' })
    expect(bareDir.state).toEqual({ page: 1, dir: 'desc' })
    expect(bareDir.redirectHref).toBe('/campanha/contatos?sort=name&dir=desc')
  })

  it('builds sort-toggle hrefs: flips the active key, applies the new key default, resets to page 1', () => {
    expect(buildContactSortHref({ page: 1 }, 'cidade')).toBe('/campanha/contatos?sort=cidade')
    // Flip from desc → asc, the key default: the dir canonicalizes away.
    expect(buildContactSortHref({ page: 1, sort: 'cidade', dir: 'desc' }, 'cidade')).toBe(
      '/campanha/contatos?sort=cidade',
    )
    expect(buildContactSortHref({ page: 1, sort: 'cidade', dir: 'desc' }, 'email')).toBe(
      '/campanha/contatos?sort=email',
    )
    expect(buildContactSortHref({ page: 1 }, 'email')).toBe('/campanha/contatos?sort=email')
    expect(buildContactSortHref({ page: 3, sort: 'cidade', dir: 'desc' }, 'name')).toBe(
      '/campanha/contatos',
    )
  })

  it('derives the omnibox primary sort options: one per key, in its default direction', () => {
    expect(contactListSortPrimaryOptions).toHaveLength(4)
    expect(contactListSortPrimaryOptions.map((option) => option.key)).toEqual([
      'name',
      'cidade',
      'estado',
      'email',
    ])
    for (const option of contactListSortPrimaryOptions) {
      expect(option.dir).toBe(defaultContactListSortDir(option.key))
    }
  })

  it('clamps an out-of-range page to totalPages', () => {
    const resolved = resolveContactListUrl({ page: '9' }, 3)
    expect(resolved.state.page).toBe(3)
    expect(resolved.redirectHref).toBe('/campanha/contatos?page=3')
  })
})

describe('contacts list source-level where', () => {
  it('returns an empty where when there is no q', () => {
    expect(buildContactListWhere({ page: 1 })).toEqual({})
  })

  it('matches q against name, email or any stored phone', () => {
    expect(buildContactListWhere({ page: 1, q: 'ana' })).toEqual({
      or: [
        { name: { like: 'ana' } },
        { email: { like: 'ana' } },
        { 'phones.value': { like: 'ana' } },
      ],
    })
  })
})
