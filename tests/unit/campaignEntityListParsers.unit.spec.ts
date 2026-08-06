/**
 * Pins the "simple" entity list parsers ahead of the Pass 2 list-system
 * consolidation (W1): organizações, demandas and assessores. Lideranças left
 * this group in B29 — its parser grew a full sort/filter contract of its own
 * and moved to `leadershipListUrl.ts`, pinned in
 * `leadershipListUrl.unit.spec.ts`. Dobradinhas left earlier in B33.
 */
import { describe, expect, it } from 'vitest'

import { advisorListHrefForPage, parseAdvisorListParams } from '@/utilities/advisorData'
import { parseDemandListParams } from '@/utilities/demand/demandListUrl'
import { parseOrganizationListParams } from '@/utilities/organizationData'

const qAndPageParsers = [['advisor', parseAdvisorListParams]] as const

describe.each(qAndPageParsers)('%s list parser (q + page)', (_name, parse) => {
  it('defaults to page 1 without q', () => {
    expect(parse({})).toEqual({ page: 1 })
  })

  it('validates page as a positive decimal integer', () => {
    expect(parse({ page: '4' }).page).toBe(4)
    expect(parse({ page: '0' }).page).toBe(1)
    expect(parse({ page: '-2' }).page).toBe(1)
    expect(parse({ page: '01' }).page).toBe(1)
    expect(parse({ page: 'abc' }).page).toBe(1)
  })

  it('trims q, omits it when empty and takes the first repeated cell', () => {
    expect(parse({ q: '  ana  ' }).q).toBe('ana')
    expect(parse({ q: '   ' }).q).toBeUndefined()
    expect(parse({ q: ['primeiro', 'segundo'] }).q).toBe('primeiro')
  })

  it('parses repeatable municipality ids and drops invalid tokens', () => {
    expect(parseAdvisorListParams({ municipality: ['12', 'bad', '0'] }).municipalities).toEqual([
      12,
    ])
    expect(parseAdvisorListParams({ municipality: ['3', '7'] }).municipalities).toEqual([3, 7])
    expect(parseAdvisorListParams({}).municipalities).toBeUndefined()
  })
})

describe('parseOrganizationListParams', () => {
  it('keeps only known organization kinds', () => {
    expect(parseOrganizationListParams({ kind: 'sindicato' }).kind).toBe('sindicato')
    expect(parseOrganizationListParams({ kind: 'clube' }).kind).toBeUndefined()
  })

  it('combines q and kind; B161 dropped page from the contract', () => {
    expect(parseOrganizationListParams({ q: 'cut', kind: 'sindicato', page: '2' })).toEqual({
      q: 'cut',
      kind: 'sindicato',
    })
  })
})

describe('parseDemandListParams', () => {
  it('keeps only known statuses and kinds', () => {
    expect(parseDemandListParams({ status: 'aberta' }).status).toBe('aberta')
    expect(parseDemandListParams({ status: 'fechada' }).status).toBeUndefined()
    expect(parseDemandListParams({ kind: 'material' }).kind).toBe('material')
    expect(parseDemandListParams({ kind: 'outra-coisa' }).kind).toBeUndefined()
  })

  it('parses trimmed search query', () => {
    expect(parseDemandListParams({ q: '  banner  ' }).q).toBe('banner')
    expect(parseDemandListParams({ q: '   ' }).q).toBeUndefined()
  })

  it('B161 — continuous list: page left the URL contract', () => {
    expect(parseDemandListParams({})).toEqual({})
    expect(parseDemandListParams({ page: '3' })).toEqual({})
  })
})

describe('advisorListHrefForPage', () => {
  it('serializes q then page against the assessores base path', () => {
    expect(advisorListHrefForPage({ page: 1 }, 1)).toBe('/campanha/assessores')
    expect(advisorListHrefForPage({ page: 1, q: 'edi' }, 3)).toBe(
      '/campanha/assessores?q=edi&page=3',
    )
  })

  it('serializes repeatable municipality filters', () => {
    expect(advisorListHrefForPage({ page: 1, municipalities: [4, 9] }, 1)).toBe(
      '/campanha/assessores?municipality=4&municipality=9',
    )
    expect(advisorListHrefForPage({ page: 1, q: 'ana', municipalities: [2] }, 2)).toBe(
      '/campanha/assessores?q=ana&municipality=2&page=2',
    )
  })
})
