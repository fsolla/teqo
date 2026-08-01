/**
 * Pins the "simple" entity list parsers ahead of the Pass 2 list-system
 * consolidation (W1): organizações and demandas. Assessores moved to
 * `advisorListUrl.ts` (CL5); lideranças left earlier in B29.
 */
import { describe, expect, it } from 'vitest'

import { parseDemandListParams, resolveDemandListUrl } from '@/utilities/campaignDemandData'
import {
  parseOrganizationListParams,
  resolveOrganizationListUrl,
} from '@/utilities/organizationData'

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

  it('redirects junk params to the canonical form', () => {
    expect(resolveOrganizationListUrl({ foo: 'bar', q: ' cut ', page: '01' })).toEqual({
      state: { page: 1, q: 'cut' },
      href: '/campanha/organizacoes?q=cut',
      redirectHref: '/campanha/organizacoes?q=cut',
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

  it('redirects junk params to the canonical form', () => {
    expect(resolveDemandListUrl({ foo: 'bar', status: 'aberta', page: '01' })).toEqual({
      state: { page: 1, status: 'aberta' },
      href: '/campanha/demandas?status=aberta',
      redirectHref: '/campanha/demandas?status=aberta',
    })
  })

  it('clamps page above totalPages', () => {
    expect(resolveDemandListUrl({ page: '9' }, 2)).toEqual({
      state: { page: 2 },
      href: '/campanha/demandas?page=2',
      redirectHref: '/campanha/demandas?page=2',
    })
  })
})
