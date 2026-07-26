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
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { isCampaignLeader } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadTerritoryOverview } from '@/utilities/loadTerritoryOverview'
import { resolveTerritoryListSort, resolveTerritoryListUrl } from '@/utilities/territoryListUrl'
import { filterTerritoryRows, sortTerritoryRows } from '@/utilities/territoryOverview'

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  const rawSearchParams = await searchParams
  const resolvedUrl = resolveTerritoryListUrl(rawSearchParams)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) return null
  if (isCampaignLeader(user)) redirect('/campanha')

  const allRows = await loadTerritoryOverview(payload)
  const { state } = resolvedUrl
  const { sort, dir } = resolveTerritoryListSort(state)
  const rows = sortTerritoryRows(filterTerritoryRows(allRows, state), sort, dir)
  const regionOptions = allRows
    .map((row) => ({ value: row.region, label: row.region }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

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
      <CampaignListPendingBoundary>
        <TerritoryFilters state={state} regionOptions={regionOptions} />
        <CampaignListResults>
          <TerritoryList rows={rows} state={state} regionOptions={regionOptions} />
          <CampaignListFooter
            totalDocs={rows.length}
            singular="território encontrado"
            plural="territórios encontrados"
            page={1}
            totalPages={1}
            hrefForPage={() => resolvedUrl.href}
          />
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
