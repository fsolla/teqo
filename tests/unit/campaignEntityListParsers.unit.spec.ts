/**
 * Pins the five "simple" entity list parsers ahead of the Pass 2 list-system
 * consolidation (W1): lideranças, organizações, dobradinhas, demandas and
 * assessores. Their URL contracts must survive the migration byte-identical.
 */
import { describe, expect, it } from 'vitest'

import { advisorListHrefForPage, parseAdvisorListParams } from '@/utilities/advisorData'
import { parseDemandListParams } from '@/utilities/campaignDemandData'
import { parseLeadershipListParams } from '@/utilities/leadershipData'
import { parseOrganizationListParams } from '@/utilities/organizationData'
import { parseStateDeputyListParams } from '@/utilities/stateDeputyData'

const qAndPageParsers = [
  ['leadership', parseLeadershipListParams],
  ['stateDeputy', parseStateDeputyListParams],
  ['advisor', parseAdvisorListParams],
] as const

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
})

describe('parseOrganizationListParams', () => {
  it('keeps only known organization kinds', () => {
    expect(parseOrganizationListParams({ kind: 'sindicato' }).kind).toBe('sindicato')
    expect(parseOrganizationListParams({ kind: 'clube' }).kind).toBeUndefined()
  })

  it('combines q, kind and page', () => {
    expect(parseOrganizationListParams({ q: 'cut', kind: 'sindicato', page: '2' })).toEqual({
      page: 2,
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

  it('defaults to page 1 with no filters', () => {
    expect(parseDemandListParams({})).toEqual({ page: 1 })
  })
})

describe('advisorListHrefForPage', () => {
  it('serializes q then page against the assessores base path', () => {
    expect(advisorListHrefForPage({ page: 1 }, 1)).toBe('/campanha/assessores')
    expect(advisorListHrefForPage({ page: 1, q: 'edi' }, 3)).toBe(
      '/campanha/assessores?q=edi&page=3',
    )
  })
})
