import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { TerritoryFilters } from '@/components/campaign/municipality/TerritoryFilters'
import { TerritoryList } from '@/components/campaign/municipality/TerritoryList'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { resolveListUnifiedEnabled } from '@/lib/opsListRegistry/opsListFlag'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadTerritoryOverviewPage } from '@/utilities/territory/loadTerritoryOverview'
import {
  buildTerritoryListHref,
  resolveTerritoryListUrl,
} from '@/utilities/territory/territoryListUrl'

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveTerritoryListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'noLeader' }),
    getPayload({ config }),
  ])

  const pageResult = await loadTerritoryOverviewPage(payload, user, canonicalUrl.state)
  const { rows, totalDocs, totalPages, regionOptions } = pageResult
  const resolvedUrl = resolveTerritoryListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const columnVisibility = await readCampaignColumnVisibility('territorios')

  const filters = <TerritoryFilters state={state} regionOptions={regionOptions} />
  const tableNode = (
    <TerritoryList
      rows={rows}
      state={state}
      regionOptions={regionOptions}
      columnVisibility={columnVisibility}
    />
  )
  const footerNode = (
    <CampaignListFooter
      totalDocs={totalDocs}
      singular="território encontrado"
      plural="territórios encontrados"
      page={state.page}
      totalPages={totalPages}
      hrefForPage={(page) => buildTerritoryListHref(state, page)}
    />
  )

  const main = resolveListUnifiedEnabled() ? (
    <OpsListPage overview={null} toolbar={filters} table={tableNode} empty={null} footer={footerNode} />
  ) : (
    <CampaignListPendingBoundary>
      {filters}
      <CampaignListResults>
        {tableNode}
        {footerNode}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <header className="flex max-w-prose flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Territórios de Identidade
        </h1>
        <p className="text-muted-foreground text-pretty">
          Compare a concentração histórica e a cobertura de assessoria das regiões da Bahia. Abra um
          território para ver seus municípios.
        </p>
      </header>
      {main}
    </CampaignPageShell>
  )
}
