import config from '@payload-config'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyListTable } from '@/components/campaign/stateDeputy/StateDeputyListTable'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { getAdvisorMunicipalityIds, isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { queryFromCanonicalHref } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadEligibleAdvisorOptions,
  loadLeadershipOptions,
} from '@/utilities/campaignRelationOptions'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { loadStateDeputyListPageData } from '@/utilities/stateDeputyData'
import {
  formatStateDeputyListSortSummary,
  resolveStateDeputyListSort,
  resolveStateDeputyListUrl,
  stateDeputyPageSize,
} from '@/utilities/stateDeputyListUrl'

export const metadata = campaignPageMetadataFromCatalog('dobradinhas')

type StateDeputiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StateDeputiesPage({ searchParams }: StateDeputiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveStateDeputyListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const columnVisibility = await readCampaignColumnVisibility('dobradinhas')
  const isLeadershipVisible = !columnVisibility.hiddenColumnIds.includes('leaderships')
  const isAdvisorsVisible = !columnVisibility.hiddenColumnIds.includes('advisors')
  // Advisor assignment is unrestricted-only (B156); the rest of staff reads.
  const canEditAdvisors = isCampaignUnrestricted(user)

  const [
    { rows, totalDocs, filterFacets },
    leadershipOptions,
    advisorOptions,
    municipalityIndex,
    administeredIds,
  ] = await Promise.all([
    loadStateDeputyListPageData(payload, user, canonicalUrl.state),
    isLeadershipVisible ? loadLeadershipOptions(payload, user) : Promise.resolve([]),
    isAdvisorsVisible && canEditAdvisors
      ? loadEligibleAdvisorOptions(payload, user)
      : Promise.resolve([]),
    loadMunicipalityPortfolioIndex(),
    user.role === 'advisor' ? getAdvisorMunicipalityIds(payload, user.id) : null,
  ])
  const { state } = canonicalUrl

  const { sort, dir } = resolveStateDeputyListSort(state)
  const sortSummary = formatStateDeputyListSortSummary(sort, dir)
  const partyFilterOptions = filterFacets.parties.map((party) => ({ value: party, label: party }))
  const query = queryFromCanonicalHref(canonicalUrl.href)

  return (
    <CampaignPageShell>
      <div className="flex justify-end">
        <Button asChild className="min-h-11">
          <Link href="/campanha/dobradinhas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova dobradinha
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <StateDeputyListTable
          rows={rows}
          totalDocs={totalDocs}
          pageSize={stateDeputyPageSize}
          state={state}
          query={query}
          columnVisibility={columnVisibility}
          partyFilterOptions={partyFilterOptions}
          hasNoParty={filterFacets.hasNoParty}
          leadershipOptions={leadershipOptions.map((option) => ({
            id: option.id,
            searchLabel: option.name,
            item: {
              id: option.id,
              label: option.name,
              href: `/campanha/liderancas/${option.id}`,
            },
          }))}
          advisorOptions={advisorOptions.map((option) => ({
            id: option.id,
            searchLabel: option.name,
            item: {
              id: option.id,
              label: option.name,
              href: `/campanha/assessores/${option.id}`,
            },
          }))}
          canEditAdvisors={canEditAdvisors}
          municipalityIndex={municipalityIndex}
          {...(administeredIds ? { addableMunicipalityIds: administeredIds } : {})}
          sortSummary={sortSummary}
        />
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
