import { describe, expect, it } from 'vitest'

import { municipalityCatalog } from '@/lib/municipalityCatalog'
import {
  buildCampaignUpdatesFeedHref,
  buildCampaignUpdatesFeedWhere,
  parseCampaignUpdatesFeedParams,
  resolveCampaignUpdatesFeedUrl,
  serializeCanonicalCampaignUpdatesFeedSearchParams,
} from '@/utilities/municipality/municipalityUpdateListUrl'
import {
  applyCampaignUpdatesFeedSuggestion,
  buildCampaignUpdatesFeedChips,
  buildCampaignUpdatesFeedSuggestions,
  clearCampaignUpdatesFeedFilters,
  removeCampaignUpdatesFeedChip,
} from '@/utilities/municipality/municipalityUpdateOmnibox'

const [firstSlug, secondSlug] = municipalityCatalog.map((entry) => entry.slug)

describe('campaign updates feed URL contract (C89)', () => {
  it('empty params resolve to the default feed and the bare base path', () => {
    const { state } = resolveCampaignUpdatesFeedUrl({})
    expect(state).toEqual({ page: 1 })
    expect(buildCampaignUpdatesFeedHref(state, 1)).toBe('/campanha/atualizacoes')
  })

  it('canonicalizes page 1 away and clamps an out-of-range page', () => {
    const parsed = parseCampaignUpdatesFeedParams({ page: '1' })
    expect(parsed.page).toBe(1)
    expect(buildCampaignUpdatesFeedHref(parsed, 1)).toBe('/campanha/atualizacoes')

    const resolved = resolveCampaignUpdatesFeedUrl({ page: '99' }, 3)
    expect(resolved.state.page).toBe(3)
  })

  it('parses free-text q and trims empties away', () => {
    const state = parseCampaignUpdatesFeedParams({ q: '  reunião  ' })
    expect(state.q).toBe('reunião')
    expect(buildCampaignUpdatesFeedHref(state, 1)).toBe('/campanha/atualizacoes?q=reuni%C3%A3o')
    expect(parseCampaignUpdatesFeedParams({ q: '   ' }).q).toBeUndefined()
  })

  it('parses municipality slugs, dropping unknown or invalid tokens', () => {
    const state = parseCampaignUpdatesFeedParams({
      slug: [firstSlug, secondSlug, 'nao-existe'],
    })
    expect(state.slugs).toEqual([firstSlug, secondSlug])
  })

  it('canonicalizes "all polarities" to absent while keeping a subset', () => {
    const all = parseCampaignUpdatesFeedParams({
      polarity: ['boa', 'neutra', 'ruim'],
    })
    expect(all.polarities).toBeUndefined()

    const subset = parseCampaignUpdatesFeedParams({ polarity: ['boa', 'ruim'] })
    expect(subset.polarities).toEqual(['boa', 'ruim'])
    expect(serializeCanonicalCampaignUpdatesFeedSearchParams(subset).toString()).toBe(
      'polarity=boa&polarity=ruim',
    )
  })

  it('treats urgent as present-only boolean', () => {
    expect(parseCampaignUpdatesFeedParams({ urgent: 'true' }).urgent).toBe(true)
    expect(parseCampaignUpdatesFeedParams({ urgent: 'false' }).urgent).toBeUndefined()
    expect(parseCampaignUpdatesFeedParams({}).urgent).toBeUndefined()
  })

  it('parses author ids numerically and sorted', () => {
    const state = parseCampaignUpdatesFeedParams({ author: ['3', 'abc', '1'] })
    expect(state.authors).toEqual([1, 3])
  })

  it('redirects when an unsupported search param is present', () => {
    const resolved = resolveCampaignUpdatesFeedUrl({ q: 'x', foo: 'bar' })
    expect(resolved.redirectHref).toBe('/campanha/atualizacoes?q=x')
  })

  it('does not redirect on the canonical contract', () => {
    const resolved = resolveCampaignUpdatesFeedUrl({ q: 'x' })
    expect(resolved.redirectHref).toBeUndefined()
  })
})

describe('campaign updates feed where builder (C89)', () => {
  it('builds an empty where for the default feed', () => {
    expect(buildCampaignUpdatesFeedWhere({ page: 1 })).toEqual({})
  })

  it('maps every dimension to its Payload constraint', () => {
    const where = buildCampaignUpdatesFeedWhere({
      page: 1,
      q: 'adesão',
      slugs: [firstSlug],
      polarities: ['boa'],
      urgent: true,
      authors: [3],
    })
    expect(where).toEqual({
      and: [
        { body: { contains: 'adesão' } },
        { 'municipality.slug': { in: [firstSlug] } },
        { polarity: { in: ['boa'] } },
        { urgent: { equals: true } },
        { author: { in: [3] } },
      ],
    })
  })

  it('filters municipality slugs through the relationship slug field, fail-closed', () => {
    const where = buildCampaignUpdatesFeedWhere({
      page: 1,
      slugs: ['slug-sem-cadastro'],
    })
    expect(where).toEqual({
      and: [{ 'municipality.slug': { in: ['slug-sem-cadastro'] } }],
    })
  })
})

describe('campaign updates feed omnibox (C89)', () => {
  const base = parseCampaignUpdatesFeedParams({})
  const authorOptions = [{ value: '3', label: 'Ana Assessora' }]
  const municipalitySlugOptions = [firstSlug]

  it('builds chips from URL filters', () => {
    const state = parseCampaignUpdatesFeedParams({
      q: 'feira',
      slug: firstSlug,
      polarity: 'boa',
      urgent: 'true',
      author: '3',
    })
    const chips = buildCampaignUpdatesFeedChips({
      state,
      municipalityNameBySlug: new Map([[firstSlug, 'Feira de Santana']]),
      authorNameById: new Map([[3, 'Ana Assessora']]),
    })
    expect(chips.map((chip) => chip.id)).toEqual([
      'q',
      `slug:${firstSlug}`,
      'polarity:boa',
      'urgent',
      'author:3',
    ])
    expect(chips.find((chip) => chip.id === 'q')?.label).toBe('Busca: feira')
  })

  // Small dimension shortcuts (urgente/polaridade/autor) surface on focus; the
  // big Município group is revealed by typing — same as the municipality list.
  it('suggests the small dimension groups on an empty query', () => {
    const suggestions = buildCampaignUpdatesFeedSuggestions({
      query: '',
      municipalitySlugOptions,
      authorOptions,
    })
    const groups = new Set(suggestions.map((suggestion) => suggestion.group))
    expect(groups).toEqual(new Set(['Urgente', 'Polaridade', 'Autor']))
  })

  it('reveals the Município group once text is typed', () => {
    const suggestions = buildCampaignUpdatesFeedSuggestions({
      query: firstSlug.slice(0, 4),
      municipalitySlugOptions,
      authorOptions,
    })
    expect(suggestions.some((entry) => entry.group === 'Município')).toBe(true)
  })

  it('matches typed text against a dimension and the text search', () => {
    const suggestions = buildCampaignUpdatesFeedSuggestions({
      query: 'pol',
      municipalitySlugOptions,
      authorOptions,
    })
    expect(suggestions.some((entry) => entry.id === 'q:pol')).toBe(true)
    expect(suggestions.some((entry) => entry.group === 'Polaridade')).toBe(true)
  })

  it('applies toggles and text search, resetting the page', () => {
    const text = applyCampaignUpdatesFeedSuggestion({
      state: base,
      suggestionId: 'q:Mucuri',
    })
    expect(text).toEqual({ kind: 'url', state: { page: 1, q: 'Mucuri' } })

    const slug = applyCampaignUpdatesFeedSuggestion({
      state: base,
      suggestionId: `slug:${firstSlug}`,
    })
    expect(slug).toEqual({ kind: 'url', state: { page: 1, slugs: [firstSlug] } })

    const urgentOn = applyCampaignUpdatesFeedSuggestion({ state: base, suggestionId: 'urgent' })
    const urgentOff = applyCampaignUpdatesFeedSuggestion({
      state: urgentOn.state,
      suggestionId: 'urgent',
    })
    expect(urgentOn).toEqual({ kind: 'url', state: { page: 1, urgent: true } })
    expect(urgentOff.state.urgent).toBeUndefined()

    const author = applyCampaignUpdatesFeedSuggestion({ state: base, suggestionId: 'author:3' })
    expect(author).toEqual({ kind: 'url', state: { page: 1, authors: [3] } })
  })

  it('rejects unknown suggestion ids and bad author ids', () => {
    expect(applyCampaignUpdatesFeedSuggestion({ state: base, suggestionId: 'nope' }).state).toEqual(
      base,
    )
    expect(
      applyCampaignUpdatesFeedSuggestion({ state: base, suggestionId: 'author:abc' }).state,
    ).toEqual(base)
    expect(
      applyCampaignUpdatesFeedSuggestion({ state: base, suggestionId: 'polarity:beta' }).state,
    ).toEqual(base)
  })

  it('removes chips dimension by dimension and clears everything', () => {
    const state = parseCampaignUpdatesFeedParams({
      q: 'x',
      slug: firstSlug,
      polarity: 'boa',
      urgent: 'true',
      author: '3',
    })
    const afterQ = removeCampaignUpdatesFeedChip({ state, chipId: 'q' })
    expect(afterQ.state.q).toBeUndefined()
    const afterSlug = removeCampaignUpdatesFeedChip({ state, chipId: `slug:${firstSlug}` })
    expect(afterSlug.state.slugs).toBeUndefined()
    const clear = clearCampaignUpdatesFeedFilters()
    expect(clear).toEqual({ kind: 'clear', state: { page: 1 } })
  })
})
