import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { RecentVisitTracker } from '@/components/campaign/dashboard/RecentVisitTracker'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import { MunicipalityFilters } from '@/components/campaign/municipality/MunicipalityFilters'
import {
  MunicipalityList,
  municipalityListPickerColumns,
} from '@/components/campaign/municipality/MunicipalityList'
import { MunicipalityListPageChrome } from '@/components/campaign/municipality/MunicipalityListPageChrome'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import {
  isCampaignCoordinator,
  isCampaignStaff,
  isCampaignUnrestricted,
} from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
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
  getEligibleLeadershipOptions,
  loadAdvisorSummaries,
} from '@/utilities/municipality/municipalityViewModels'
import {
  createMunicipalityListUpdateFormAction,
  createMunicipalityStateDeputyFormAction,
  setMunicipalityStateDeputiesFormAction,
} from './municipalityStaffFormActions'

export const metadata = campaignPageMetadataFromCatalog('municipios')

type MunicipalitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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
    filterFacets,
    leadershipNamesById,
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
  const [advisorSummaries, advisorOptions, leadershipOptions, stateDeputyOptions] =
    await Promise.all([
      isStaffView ? loadAdvisorSummaries(payload, user, advisorIDs) : [],
      // Only the coordinator-only assign-advisors control consumes these.
      isCoordinator ? getEligibleAdvisorOptions(payload, user) : [],
      // All staff edit the Lideranças column (scoped server-side); the leader
      // never reaches this page (`gate: noLeader`).
      isStaffView ? getEligibleLeadershipOptions(payload, user) : [],
      // B157 — the Dobradinhas column is coordinator + candidate only; the
      // catalog serves the avatar-stack display, the tooltip and the search.
      canMoveEngagementLevel ? loadStateDeputyOptions(payload, user) : [],
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
      slugFilterValues={columnFilterOptions.name}
      trailing={
        <CampaignColumnPickerTrailing
          columnVisibility={columnVisibility}
          columns={municipalityListPickerColumns({
            isStaffView,
            isCampaignUnrestricted: canMoveEngagementLevel,
          })}
        />
      }
    />
  )

  // The table's filter header stays mounted even with zero results — only the
  // rows are replaced by the empty state.
  const listBody = (
    <>
      <MunicipalityList
        municipalities={listMunicipalities}
        advisorNamesById={advisorNamesById}
        leadershipNamesById={leadershipNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        isCampaignUnrestricted={canMoveEngagementLevel}
        canMoveEngagementLevel={canMoveEngagementLevel}
        advisorOptions={advisorOptions}
        leadershipOptions={leadershipOptions}
        stateDeputyOptions={stateDeputyOptions}
        stateDeputyCommitAction={setMunicipalityStateDeputiesFormAction}
        stateDeputyCreateAction={createMunicipalityStateDeputyFormAction}
        columnFilterOptions={columnFilterOptions}
        signalFormAction={createMunicipalityListUpdateFormAction}
        state={state}
        columnVisibility={columnVisibility}
      />
      <CampaignListFooter
        totalDocs={totalDocs}
        singular="município encontrado"
        plural="municípios encontrados"
        page={state.page}
        totalPages={totalPages}
        hrefForPage={(page) => buildMunicipalityListHref(state, page)}
      />
    </>
  )

  // Shared transition: filters navigate, results dim. Staff provider wraps filters + results.
  const listRegion = (
    <>
      {filters}
      <CampaignListResults>{listBody}</CampaignListResults>
    </>
  )

  const main = (
    <CampaignListPendingBoundary>
      {isStaffView ? (
        <MunicipalityEstimateScenarioProvider>{listRegion}</MunicipalityEstimateScenarioProvider>
      ) : (
        listRegion
      )}
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <MunicipalityListPageChrome />
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
