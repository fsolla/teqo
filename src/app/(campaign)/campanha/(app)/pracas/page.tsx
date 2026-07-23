import config from '@payload-config'
import { SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { PlazaEstimateScenarioProvider } from '@/components/campaign/PlazaEstimateScenarioContext'
import { PlazaFilters } from '@/components/campaign/PlazaFilters'
import { PlazaList } from '@/components/campaign/PlazaList'
import { PlazaListOverview } from '@/components/campaign/PlazaListOverview'
import { PlazaMapPanelDynamic } from '@/components/campaign/PlazaMapPanelDynamic'
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
import { isCampaignCoordinator, isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadPlazaListPageBundle } from '@/utilities/plazaPageData'
import {
  buildPlazaFiltersKey,
  buildPlazaListHref,
  buildPlazaListVisitHref,
  buildPlazaListVisitLabel,
  getCampaignScopeLabel,
  resolvePlazaListUrl,
} from '@/utilities/plazaUi'
import { getEligibleAdvisorOptions, loadAdvisorSummaries } from '@/utilities/plazaViewModels'
import {
  assignPlazaAdvisorsFormAction,
  setPlazaPoliticalTrendFormAction,
} from './plazaStaffFormActions'

type PlazasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PlazasPage({ searchParams }: PlazasPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolvePlazaListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) return null
  const isStaffView = isCampaignStaff(user)
  const isCoordinator = isCampaignCoordinator(user)

  const pageBundle = await loadPlazaListPageBundle(payload, user, rawSearchParams)
  const candidateOptions = pageBundle.mapBundle
    ? await loadFederalCandidateOptions(payload, user)
    : []
  const { plazas: listPlazas, totalDocs, totalPages, scopeTotal, overview, mapBundle } = pageBundle
  const resolvedUrl = resolvePlazaListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl
  const listVisitLabel = buildPlazaListVisitLabel(state)

  const advisorIDs = [...new Set(listPlazas.flatMap((plaza) => plaza.advisorIDs))]
  const advisorSummaries = isStaffView ? await loadAdvisorSummaries(payload, user, advisorIDs) : []
  const advisorNamesById = new Map(advisorSummaries.map((advisor) => [advisor.id, advisor]))
  const advisorOptions = isCoordinator ? await getEligibleAdvisorOptions(payload, user) : []

  const filters = (
    <PlazaFilters key={buildPlazaFiltersKey(state)} state={state} showStaffFilters={isStaffView} />
  )

  const listBody = listPlazas.length ? (
    <>
      {isStaffView && overview ? <PlazaListOverview view={overview} /> : null}
      <PlazaList
        plazas={listPlazas}
        advisorNamesById={advisorNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        advisorOptions={advisorOptions}
        trendFormAction={setPlazaPoliticalTrendFormAction}
        advisorsFormAction={assignPlazaAdvisorsFormAction}
      />
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {totalDocs} {totalDocs === 1 ? 'Praça encontrada' : 'Praças encontradas'}
        </p>
        <CampaignListPagination
          page={state.page}
          totalPages={totalPages}
          hrefForPage={(page) => buildPlazaListHref(state, page)}
        />
      </div>
    </>
  ) : (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Nenhuma Praça encontrada</EmptyTitle>
        <EmptyDescription>
          Ajuste a busca ou os filtros. Você só vê Praças dentro do seu escopo.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/campanha/pracas">Limpar busca e filtros</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )

  const main = isStaffView ? (
    <PlazaEstimateScenarioProvider>
      {mapBundle ? (
        <PlazaMapPanelDynamic bundle={mapBundle} candidateOptions={candidateOptions} />
      ) : null}
      {filters}
      {listBody}
    </PlazaEstimateScenarioProvider>
  ) : (
    <>
      {filters}
      {listBody}
    </>
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Praças</h1>
        <p className="text-muted-foreground">
          As 436 Praças da campanha: um município cada — em Salvador e Camaçari, uma zona eleitoral
          cada.
        </p>
        <CampaignScopeBadge>{getCampaignScopeLabel(user.role, scopeTotal)}</CampaignScopeBadge>
      </header>

      {main}
      {listVisitLabel ? (
        <RecentVisitTracker
          entry={{
            href: buildPlazaListVisitHref(state),
            label: listVisitLabel,
            kind: 'plazaList',
          }}
        />
      ) : null}
    </CampaignPageShell>
  )
}
