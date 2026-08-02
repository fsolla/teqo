import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { TerritoryFilters } from '@/components/campaign/municipality/TerritoryFilters'
import { territoryListPickerColumns } from '@/components/campaign/municipality/TerritoryListColumns'
import { TerritoryList } from '@/components/campaign/municipality/TerritoryList'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadTerritoryOverview } from '@/utilities/territory/loadTerritoryOverview'
import {
  resolveTerritoryListSort,
  resolveTerritoryListUrl,
} from '@/utilities/territory/territoryListUrl'
import { filterTerritoryRows, sortTerritoryRows } from '@/utilities/territory/territoryOverview'

export const metadata = campaignPageMetadataFromCatalog('territorios')

type TerritoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TerritoriesPage({ searchParams }: TerritoriesPageProps) {
  const rawSearchParams = await searchParams
  const resolvedUrl = resolveTerritoryListUrl(rawSearchParams)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'noLeader' }),
    getPayload({ config }),
  ])

  const allRows = await loadTerritoryOverview(payload, user)
  const columnVisibility = await readCampaignColumnVisibility('territorios')
  const { state } = resolvedUrl
  const { sort, dir } = resolveTerritoryListSort(state)
  const rows = sortTerritoryRows(filterTerritoryRows(allRows, state), sort, dir)
  const regionOptions = allRows
    .map((row) => ({ value: row.region, label: row.region }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  return (
    <CampaignPageShell>
      <CampaignListPendingBoundary>
        <TerritoryFilters
          state={state}
          regionOptions={regionOptions}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={territoryListPickerColumns}
            />
          }
        />
        <CampaignListResults>
          <TerritoryList
            rows={rows}
            state={state}
            regionOptions={regionOptions}
            columnVisibility={columnVisibility}
          />
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
