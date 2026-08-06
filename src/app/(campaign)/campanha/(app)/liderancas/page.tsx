import config from '@payload-config'
import { PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipListTable } from '@/components/campaign/leadership/LeadershipListTable'
import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { resolvedPortfolioEntriesById } from '@/lib/municipalityPortfolio'
import { getAdvisorMunicipalityIds } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { queryFromCanonicalHref } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import { loadLeadershipListPageData } from '@/utilities/leadership/leadershipData'
import type { LeadershipFilterOption } from '@/utilities/leadership/leadershipListFilters'
import {
  formatLeadershipListSortSummary,
  leadershipPageSize,
  resolveLeadershipListSort,
  resolveLeadershipListUrl,
} from '@/utilities/leadership/leadershipListUrl'
import { loadOrganizationNamesByIds } from '@/utilities/loadNamesByIds'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { loadStateDeputySummaries } from '@/utilities/stateDeputyData'

export const metadata = campaignPageMetadataFromCatalog('liderancas')

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveLeadershipListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const columnVisibility = await readCampaignColumnVisibility('liderancas')
  const isStateDeputyVisible = !columnVisibility.hiddenColumnIds.includes('stateDeputies')

  const [
    { rows, totalDocs, filterFacets },
    stateDeputyOptions,
    municipalityIndex,
    administeredIds,
  ] = await Promise.all([
    loadLeadershipListPageData(payload, user, canonicalUrl.state),
    isStateDeputyVisible ? loadStateDeputyOptions(payload, user) : Promise.resolve([]),
    loadMunicipalityPortfolioIndex(),
    user.role === 'advisor' ? getAdvisorMunicipalityIds(payload, user.id) : null,
  ])
  const { state } = canonicalUrl

  const municipalityById = resolvedPortfolioEntriesById(municipalityIndex)
  const municipalityFilterOptions: LeadershipFilterOption[] = filterFacets.municipalityIDs
    .map((id) => {
      const entry = municipalityById.get(id)
      return entry ? { value: String(id), label: entry.name } : null
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const [organizationNames, stateDeputySummaries] = await Promise.all([
    loadOrganizationNamesByIds(payload, filterFacets.organizationIDs),
    loadStateDeputySummaries(payload, filterFacets.stateDeputyIDs),
  ])

  const organizationFilterOptions: LeadershipFilterOption[] = filterFacets.organizationIDs
    .map((id) => {
      const label = organizationNames.get(id)
      return label ? { value: String(id), label } : null
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const stateDeputyById = new Map(stateDeputySummaries.map((summary) => [summary.id, summary]))
  const stateDeputyFilterOptions: LeadershipFilterOption[] = filterFacets.stateDeputyIDs
    .map((id) => {
      const summary = stateDeputyById.get(id)
      if (!summary) return null
      const label = summary.party ? `${summary.name} (${summary.party})` : summary.name
      return { value: String(id), label }
    })
    .filter((option): option is LeadershipFilterOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const { sort, dir } = resolveLeadershipListSort(state)
  const sortSummary = formatLeadershipListSortSummary(sort, dir)
  const query = queryFromCanonicalHref(canonicalUrl.href)

  return (
    <CampaignPageShell>
      <div className="flex justify-end">
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </div>

      <CampaignListPendingBoundary>
        <LeadershipListTable
          rows={rows}
          totalDocs={totalDocs}
          pageSize={leadershipPageSize}
          state={state}
          query={query}
          columnVisibility={columnVisibility}
          stateDeputyOptions={stateDeputyOptions.map((option) => ({
            id: option.id,
            searchLabel: option.name,
            item: {
              id: option.id,
              label: option.plainName,
              href: `/campanha/dobradinhas/${option.slug}`,
              ...(option.party ? { party: option.party } : {}),
            },
          }))}
          municipalityIndex={municipalityIndex}
          municipalityFilterOptions={municipalityFilterOptions}
          organizationFilterOptions={organizationFilterOptions}
          stateDeputyFilterOptions={stateDeputyFilterOptions}
          {...(administeredIds ? { addableMunicipalityIds: administeredIds } : {})}
          sortSummary={sortSummary}
        />
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
