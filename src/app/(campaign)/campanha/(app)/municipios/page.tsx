import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/CampaignListPending'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/MunicipalityEstimateScenarioContext'
import { MunicipalityFilters } from '@/components/campaign/MunicipalityFilters'
import { MunicipalityList } from '@/components/campaign/MunicipalityList'
import { MunicipalityListOverview } from '@/components/campaign/MunicipalityListOverview'
import { RecentVisitTracker } from '@/components/campaign/RecentVisitTracker'
import {
  isCampaignCoordinator,
  isCampaignLeader,
  isCampaignStaff,
} from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadMunicipalityListPageBundle } from '@/utilities/municipalityPageData'
import {
  buildMunicipalityFiltersKey,
  buildMunicipalityListHref,
  buildMunicipalityListVisitHref,
  buildMunicipalityListVisitLabel,
  getCampaignScopeLabel,
  municipalityFilterOptionsForSlugs,
  resolveMunicipalityListUrl,
} from '@/utilities/municipalityUi'
import { getEligibleAdvisorOptions, loadAdvisorSummaries } from '@/utilities/municipalityViewModels'
import {
  assignMunicipalityAdvisorsFormAction,
  setMunicipalityPoliticalTrendFormAction,
} from './municipalityStaffFormActions'

type MunicipalitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MunicipalitiesPage({ searchParams }: MunicipalitiesPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveMunicipalityListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) return null
  if (isCampaignLeader(user)) redirect('/campanha')
  const isStaffView = isCampaignStaff(user)
  const isCoordinator = isCampaignCoordinator(user)

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
    name: municipalityFilterOptionsForSlugs(filterFacets.slugs),
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
      key={buildMunicipalityFiltersKey(state)}
      state={state}
      showStaffFilters={isStaffView}
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
  // results — only the rows are replaced by the empty state.
  const listBody = (
    <>
      {isStaffView && overview ? (
        <MunicipalityListOverview view={overview} shameHref={shameHref} />
      ) : null}
      <MunicipalityList
        municipalities={listMunicipalities}
        advisorNamesById={advisorNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        advisorOptions={advisorOptions}
        columnFilterOptions={columnFilterOptions}
        trendFormAction={setMunicipalityPoliticalTrendFormAction}
        advisorsFormAction={assignMunicipalityAdvisorsFormAction}
        state={state}
      />
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {totalDocs} {totalDocs === 1 ? 'município encontrado' : 'municípios encontrados'}
        </p>
        <CampaignListPagination
          page={state.page}
          totalPages={totalPages}
          hrefForPage={(page) => buildMunicipalityListHref(state, page)}
        />
      </div>
    </>
  )

  // Shared transition: the filters navigate, the results dim ("Feel the action").
  // The estimate-scenario provider wraps ONLY the results — a scenario switch
  // re-renders the overview/list cells, never the filter controls.
  const main = (
    <CampaignListPendingBoundary>
      {filters}
      <CampaignListResults>
        {isStaffView ? (
          <MunicipalityEstimateScenarioProvider>{listBody}</MunicipalityEstimateScenarioProvider>
        ) : (
          listBody
        )}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Municípios</h1>
        <p className="text-muted-foreground">
          Os 435 municípios da campanha: um por município da Bahia — em Salvador, uma zona eleitoral
          cada.
        </p>
        <CampaignScopeBadge>{getCampaignScopeLabel(user.role, scopeTotal)}</CampaignScopeBadge>
      </header>

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
    </CampaignPageShell>
  )
}
