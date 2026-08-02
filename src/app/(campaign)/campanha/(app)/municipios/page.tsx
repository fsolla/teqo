import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { RecentVisitTracker } from '@/components/campaign/dashboard/RecentVisitTracker'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { MunicipalityFilters } from '@/components/campaign/municipality/MunicipalityFilters'
import { MunicipalityList } from '@/components/campaign/municipality/MunicipalityList'
import { MunicipalityListOverview } from '@/components/campaign/municipality/MunicipalityListOverview'
import { OfflineBoundary } from '@/components/campaign/opsSync/OfflineBoundary'
import { OpsListLocal } from '@/components/campaign/opsSync/OpsListLocal'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignListPageHeader } from '@/components/campaign/shared/CampaignListPageHeader'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import {
  isCampaignCoordinator,
  isCampaignStaff,
  isCampaignUnrestricted,
} from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { getCampaignScopeLabel } from '@/utilities/municipality/municipalityLabels'
import {
  buildMunicipalityListVisitHref,
  buildMunicipalityListVisitLabel,
} from '@/utilities/municipality/municipalityListFilters'
import {
  buildMunicipalityListHref,
  resolveMunicipalityListUrl,
} from '@/utilities/municipality/municipalityListUrl'
import { loadMunicipalityListPageBundle } from '@/utilities/municipality/municipalityPageData'
import {
  getEligibleAdvisorOptions,
  loadAdvisorSummaries,
} from '@/utilities/municipality/municipalityViewModels'
import { createMunicipalityListSignalFormAction } from './municipalityStaffFormActions'

type MunicipalitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const wrapStaffListRegion = (isStaffView: boolean, listRegion: ReactNode): ReactNode =>
  isStaffView ? (
    <MunicipalityEstimateScenarioProvider>{listRegion}</MunicipalityEstimateScenarioProvider>
  ) : (
    listRegion
  )

export default async function MunicipalitiesPage({ searchParams }: MunicipalitiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveMunicipalityListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'noLeader' }),
    getPayload({ config }),
  ])
  const isStaffView = isCampaignStaff(user)
  const isCoordinator = isCampaignCoordinator(user)
  const canMoveEngagementLevel = isCampaignUnrestricted(user)

  const pageBundle = await loadMunicipalityListPageBundle(payload, user, rawSearchParams)
  const {
    municipalities: listMunicipalities,
    totalDocs,
    totalPages,
    scopeTotal,
    overview,
    filterFacets,
  } = pageBundle
  const resolvedUrl = resolveMunicipalityListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const listVisitLabel = buildMunicipalityListVisitLabel(state)
  const columnVisibility = await readCampaignColumnVisibility('municipios')

  // One read covers both needs: the listed municipalities' avatars and the
  // (cross-filtered) advisor column-filter labels.
  const advisorIDs = [
    ...new Set([
      ...listMunicipalities.flatMap((municipality) => municipality.advisorIDs),
      ...filterFacets.advisorIDs,
    ]),
  ]
  const [advisorSummaries, advisorOptions] = await Promise.all([
    isStaffView ? loadAdvisorSummaries(payload, user, advisorIDs) : [],
    // Only the coordinator-only assign-advisors control consumes these.
    isCoordinator ? getEligibleAdvisorOptions(payload, user) : [],
  ])
  const advisorNamesById = new Map(advisorSummaries.map((advisor) => [advisor.id, advisor]))

  const selectedAdvisorIDs = new Set(state.advisors ?? [])
  const columnFilterOptions = {
    // Bare slugs: the filter popover labels them from the catalog on the
    // client, so the RSC payload never carries 435 name pairs (B16+).
    name: filterFacets.slugs,
    region: filterFacets.regions.map((region) => ({ value: region, label: region })),
    advisor: filterFacets.advisorIDs
      .flatMap((id) => {
        const name = advisorNamesById.get(id)?.name
        if (name) return [{ value: String(id), label: name }]
        // Keep an unknown-but-selected advisor listed so the filter can be undone.
        return selectedAdvisorIDs.has(id) ? [{ value: String(id), label: `Assessor #${id}` }] : []
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
  }

  const filters = (
    <MunicipalityFilters
      state={state}
      showStaffFilters={isStaffView}
      regionFilterOptions={columnFilterOptions.region}
      advisorFilterOptions={columnFilterOptions.advisor}
    />
  )

  // E9 coluna da vergonha: same scope, filtered down to priority municipalities
  // with nobody answering for them. `null` when that is already the filter.
  const shameHref =
    state.priority === 'alta' && state.coverage === 'sem_assessor'
      ? null
      : buildMunicipalityListHref({ ...state, priority: 'alta', coverage: 'sem_assessor' }, 1)

  // The overview and the table's filter header stay mounted even with zero
  // results — only the rows are replaced by the empty state (inside MunicipalityList).
  // B120: hide the KPI strip on mobile (viewport budget); keep it on md+.
  const overviewNode =
    isStaffView && overview ? (
      <div className="hidden md:block">
        <MunicipalityListOverview view={overview} shameHref={shameHref} />
      </div>
    ) : null

  const tableNode = (
    <MunicipalityList
      municipalities={listMunicipalities}
      advisorNamesById={advisorNamesById}
      isStaffView={isStaffView}
      isCoordinator={isCoordinator}
      canMoveEngagementLevel={canMoveEngagementLevel}
      advisorOptions={advisorOptions}
      columnFilterOptions={columnFilterOptions}
      signalFormAction={createMunicipalityListSignalFormAction}
      state={state}
      columnVisibility={columnVisibility}
    />
  )

  const footerNode = (
    <CampaignListFooter
      totalDocs={totalDocs}
      singular="município encontrado"
      plural="municípios encontrados"
      page={state.page}
      totalPages={totalPages}
      hrefForPage={(page) => buildMunicipalityListHref(state, page)}
    />
  )

  // Provider wraps outside the pending boundary (OpsListPage owns pending chrome).
  const main = wrapStaffListRegion(
    isStaffView,
    <OpsListPage
      overview={overviewNode}
      toolbar={filters}
      table={tableNode}
      empty={null}
      footer={footerNode}
    />,
  )

  return (
    <CampaignPageShell>
      <OfflineBoundary fallback={<OpsListLocal slug="municipios" />}>
        <CampaignListPageHeader
          title="Municípios"
          description="Os 435 municípios da campanha: um por município da Bahia — em Salvador, uma zona eleitoral cada."
          scope={
            <CampaignScopeBadge>{getCampaignScopeLabel(user.role, scopeTotal)}</CampaignScopeBadge>
          }
        />

        {main}
        {listVisitLabel ? (
          <RecentVisitTracker
            entry={{
              href: buildMunicipalityListVisitHref(state),
              label: listVisitLabel,
              kind: 'municipalityList',
            }}
          />
        ) : null}
      </OfflineBoundary>
    </CampaignPageShell>
  )
}
