import config from '@payload-config'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { OrganizationListTable } from '@/components/campaign/organization/OrganizationListTable'
import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { queryFromCanonicalHref } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  buildOrganizationListHref,
  loadOrganizationListPageData,
  organizationPageSize,
  parseOrganizationListParams,
} from '@/utilities/organizationData'

export const metadata = campaignPageMetadataFromCatalog('organizacoes')

type OrganizationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const state = parseOrganizationListParams(rawSearchParams)
  const { rows, totalDocs } = await loadOrganizationListPageData(payload, user, state)
  const columnVisibility = await readCampaignColumnVisibility('organizacoes')
  const query = queryFromCanonicalHref(buildOrganizationListHref(state))

  return (
    <CampaignPageShell>
      <div className="flex justify-end">
        <Button asChild className="min-h-11">
          <Link href="/campanha/organizacoes/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova organização
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <OrganizationListTable
          rows={rows}
          totalDocs={totalDocs}
          pageSize={organizationPageSize}
          state={state}
          query={query}
          columnVisibility={columnVisibility}
        />
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
