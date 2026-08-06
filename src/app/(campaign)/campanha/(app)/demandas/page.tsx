import config from '@payload-config'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { DemandListTable } from '@/components/campaign/demand/DemandListTable'
import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import {
  buildDemandListHref,
  demandPageSize,
  loadDemandListPageData,
  parseDemandListParams,
} from '@/utilities/campaignDemandData'
import { queryFromCanonicalHref } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const metadata = campaignPageMetadataFromCatalog('demandas')

type DemandsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DemandsPage({ searchParams }: DemandsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const state = parseDemandListParams(rawSearchParams)
  const { rows, totalDocs } = await loadDemandListPageData(payload, user, state)
  const columnVisibility = await readCampaignColumnVisibility('demandas')
  const query = queryFromCanonicalHref(buildDemandListHref(state))

  return (
    <CampaignPageShell>
      <div className="flex justify-end">
        <Button asChild className="min-h-11">
          <Link href="/campanha/demandas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova demanda
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <DemandListTable
          rows={rows}
          totalDocs={totalDocs}
          pageSize={demandPageSize}
          state={state}
          query={query}
          columnVisibility={columnVisibility}
        />
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
