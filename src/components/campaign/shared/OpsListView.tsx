'use client'

import type { ReactNode } from 'react'

import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'

export type OpsListViewProps = {
  /** Região acima da tabela: KPIs/overview (municipios, apoiadores) ou null. */
  overview: ReactNode | null
  /** Barra de filtros/search do domínio (MunicipalityFilters, LeadershipFilters, …). */
  toolbar: ReactNode
  /** A tabela já resolvida (CampaignTable com colunas do domínio). */
  table: ReactNode
  /** Empty state (CampaignListEmptyState ou Empty do domínio). */
  empty: ReactNode
  /** Footer/paginação (CampaignListFooter / CampaignListPagination). */
  footer: ReactNode
}

/**
 * CL3 — composição genérica de slots para listas unificadas.
 *
 * Não é dona de dados: a page do domínio decide `table` vs `empty` e monta as
 * peças. Toolbar fica fora de `CampaignListResults` para não dimar com o pending
 * (paridade com as pages actuais).
 */
export const OpsListView = ({ overview, toolbar, table, empty, footer }: OpsListViewProps) => (
  <CampaignListPendingBoundary>
    {toolbar}
    <CampaignListResults>
      {overview}
      {table}
      {empty}
      {footer}
    </CampaignListResults>
  </CampaignListPendingBoundary>
)
