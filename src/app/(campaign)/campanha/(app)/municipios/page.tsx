import config from '@payload-config'
import { SearchXIcon } from 'lucide-react'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
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
  } = pageBundle
  const resolvedUrl = resolveMunicipalityListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const listVisitLabel = buildMunicipalityListVisitLabel(state)

  const advisorIDs = [
    ...new Set(listMunicipalities.flatMap((municipality) => municipality.advisorIDs)),
  ]
  const advisorSummaries = isStaffView ? await loadAdvisorSummaries(payload, user, advisorIDs) : []
  const advisorNamesById = new Map(advisorSummaries.map((advisor) => [advisor.id, advisor]))
  const advisorOptions = isCoordinator ? await getEligibleAdvisorOptions(payload, user) : []

  const filters = (
    <MunicipalityFilters
      key={buildMunicipalityFiltersKey(state)}
      state={state}
      showStaffFilters={isStaffView}
    />
  )

  const listBody = listMunicipalities.length ? (
    <>
      {isStaffView && overview ? <MunicipalityListOverview view={overview} /> : null}
      <MunicipalityList
        municipalities={listMunicipalities}
        advisorNamesById={advisorNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        advisorOptions={advisorOptions}
        trendFormAction={setMunicipalityPoliticalTrendFormAction}
        advisorsFormAction={assignMunicipalityAdvisorsFormAction}
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
  ) : (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Nenhum município encontrado</EmptyTitle>
        <EmptyDescription>
          Ajuste a busca ou os filtros. Você só vê municípios dentro do seu escopo.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/campanha/municipios">Limpar busca e filtros</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )

  const main = isStaffView ? (
    <MunicipalityEstimateScenarioProvider>
      {filters}
      {listBody}
    </MunicipalityEstimateScenarioProvider>
  ) : (
    <>
      {filters}
      {listBody}
    </>
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
