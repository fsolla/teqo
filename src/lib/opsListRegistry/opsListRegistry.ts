/**
 * CL2 — client-safe metadata for the eight v1 campaign list domains.
 *
 * SSOT for slug → route/gate/sort/column-picker lives in
 * `docs/plans/lista-unificada-campanha-spec.md` § Escopo travado.
 * Loaders and URL parsers stay in `utilities/` — this module never imports them.
 *
 * `atividades` is intentionally absent: cards + tabs (Pass 2 D5) are out of scope
 * for the unified list factory — `getOpsListDomain('atividades')` returns `null`.
 */

import type { CampaignListId } from '@/lib/campaignColumnVisibility'

export const opsListDomains = [
  'municipios',
  'liderancas',
  'dobradinhas',
  'demandas',
  'assessores',
  'territorios',
  'apoiadores',
  'organizacoes',
] as const

export type OpsListDomainId = (typeof opsListDomains)[number]

export type OpsListDomainMeta = {
  id: OpsListDomainId
  routePath: string
  gate: 'staff' | 'noLeader' | 'unrestricted'
  columnListId: CampaignListId | null
  savedFilters: boolean
  sortModel: 'url' | 'fixed' | 'memory'
  canonicalRedirect: boolean
  layout: 'table'
}

export const opsListRegistry: Record<OpsListDomainId, OpsListDomainMeta> = {
  municipios: {
    id: 'municipios',
    routePath: '/campanha/municipios',
    gate: 'noLeader',
    columnListId: 'municipios',
    savedFilters: true,
    sortModel: 'url',
    canonicalRedirect: true,
    layout: 'table',
  },
  liderancas: {
    id: 'liderancas',
    routePath: '/campanha/liderancas',
    gate: 'staff',
    columnListId: 'liderancas',
    savedFilters: false,
    sortModel: 'url',
    canonicalRedirect: true,
    layout: 'table',
  },
  dobradinhas: {
    id: 'dobradinhas',
    routePath: '/campanha/dobradinhas',
    gate: 'staff',
    columnListId: 'dobradinhas',
    savedFilters: false,
    sortModel: 'url',
    canonicalRedirect: true,
    layout: 'table',
  },
  demandas: {
    id: 'demandas',
    routePath: '/campanha/demandas',
    gate: 'staff',
    columnListId: 'demandas',
    savedFilters: false,
    sortModel: 'fixed',
    canonicalRedirect: true,
    layout: 'table',
  },
  assessores: {
    id: 'assessores',
    routePath: '/campanha/assessores',
    gate: 'unrestricted',
    columnListId: 'assessores',
    savedFilters: false,
    sortModel: 'fixed',
    canonicalRedirect: true,
    layout: 'table',
  },
  territorios: {
    id: 'territorios',
    routePath: '/campanha/territorios',
    gate: 'noLeader',
    columnListId: 'territorios',
    savedFilters: false,
    sortModel: 'url',
    canonicalRedirect: true,
    layout: 'table',
  },
  apoiadores: {
    id: 'apoiadores',
    routePath: '/campanha/apoiadores',
    gate: 'staff',
    columnListId: 'apoiadores',
    savedFilters: false,
    sortModel: 'url',
    canonicalRedirect: true,
    layout: 'table',
  },
  organizacoes: {
    id: 'organizacoes',
    routePath: '/campanha/organizacoes',
    gate: 'staff',
    columnListId: 'organizacoes',
    savedFilters: false,
    sortModel: 'fixed',
    canonicalRedirect: true,
    layout: 'table',
  },
}

const isOpsListDomainId = (slug: string): slug is OpsListDomainId =>
  opsListDomains.some((domainId) => domainId === slug)

export const getOpsListDomain = (slug: string): OpsListDomainMeta | null =>
  isOpsListDomainId(slug) ? opsListRegistry[slug] : null
