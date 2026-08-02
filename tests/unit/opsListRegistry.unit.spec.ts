import { describe, expect, it } from 'vitest'

import type { CampaignListId } from '@/lib/campaignColumnVisibility'
import {
  getOpsListDomain,
  opsListDomains,
  opsListRegistry,
  type OpsListDomainMeta,
} from '@/lib/opsListRegistry/opsListRegistry'

const CAMPAIGN_LIST_IDS: readonly CampaignListId[] = [
  'municipios',
  'liderancas',
  'dobradinhas',
  'organizacoes',
  'demandas',
  'apoiadores',
  'territorios',
  'assessores',
]

const isCampaignListId = (value: string): value is CampaignListId =>
  CAMPAIGN_LIST_IDS.some((listId) => listId === value)

describe('opsListRegistry v1', () => {
  it('covers exactly eight v1 slugs with matching registry entries', () => {
    expect(opsListDomains).toHaveLength(8)
    for (const slug of opsListDomains) {
      expect(opsListRegistry[slug].id).toBe(slug)
    }
  })

  it('keeps registry keys aligned with opsListDomains', () => {
    expect(Object.keys(opsListRegistry).sort()).toEqual([...opsListDomains].sort())
  })

  it('matches the SSOT routePath order from lista-unificada-campanha-spec', () => {
    const routePaths = opsListDomains.map((slug) => opsListRegistry[slug].routePath)
    expect(routePaths).toEqual([
      '/campanha/municipios',
      '/campanha/liderancas',
      '/campanha/dobradinhas',
      '/campanha/demandas',
      '/campanha/assessores',
      '/campanha/territorios',
      '/campanha/apoiadores',
      '/campanha/organizacoes',
    ])
  })

  it.each(opsListDomains)('%s has /campanha/ routePath and table layout', (slug) => {
    const meta = opsListRegistry[slug]
    expect(meta.routePath.startsWith('/campanha/')).toBe(true)
    expect(meta.layout).toBe('table')
    expect(meta.id).toBe(slug)
  })

  it('pins municipios saved filters and canonical redirect', () => {
    const meta = getOpsListDomain('municipios')
    expect(meta).not.toBeNull()
    expect(meta?.savedFilters).toBe(true)
    expect(meta?.canonicalRedirect).toBe(true)
  })

  it('pins territorios to url sort after CL6a (no memory stub)', () => {
    const meta = getOpsListDomain('territorios')
    expect(meta).not.toBeNull()
    expect(meta?.sortModel).toBe('url')
    expect(meta?.canonicalRedirect).toBe(true)
    expect(meta?.columnListId).toBe('territorios')
  })

  it('pins demandas and organizacoes canonical redirect after CL8', () => {
    expect(getOpsListDomain('demandas')?.canonicalRedirect).toBe(true)
    expect(getOpsListDomain('organizacoes')?.canonicalRedirect).toBe(true)
  })

  it('returns null for atividades (cards layout — excluded from factory)', () => {
    expect(getOpsListDomain('atividades')).toBeNull()
    expect(getOpsListDomain('unknown-slug')).toBeNull()
  })

  it('rejects invalid columnListId values at runtime', () => {
    for (const slug of opsListDomains) {
      const { columnListId } = opsListRegistry[slug]
      if (columnListId === null) continue
      expect(isCampaignListId(columnListId)).toBe(true)
    }
    expect(opsListRegistry.assessores.columnListId).toBe('assessores')
    expect(opsListRegistry.assessores.canonicalRedirect).toBe(true)
  })

  it('requires every meta field (no partial entries)', () => {
    const requiredKeys: (keyof OpsListDomainMeta)[] = [
      'id',
      'routePath',
      'gate',
      'columnListId',
      'savedFilters',
      'sortModel',
      'canonicalRedirect',
      'layout',
    ]

    for (const slug of opsListDomains) {
      const meta = opsListRegistry[slug]
      for (const key of requiredKeys) {
        expect(meta[key], `${slug}.${key}`).toBeDefined()
      }
    }
  })
})
