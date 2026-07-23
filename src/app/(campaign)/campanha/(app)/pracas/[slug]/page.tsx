import config from '@payload-config'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CandidateComparePicker } from '@/components/campaign/CandidateComparePicker'
import { DeclareVotesForm } from '@/components/campaign/DeclareVotesForm'
import { PlazaBaselineCard } from '@/components/campaign/PlazaBaselineCard'
import { PlazaCandidateComparisonTable } from '@/components/campaign/PlazaCandidateComparisonTable'
import { PlazaLeadershipsPanel } from '@/components/campaign/PlazaLeadershipsPanel'
import { PlazaPledgesPanel } from '@/components/campaign/PlazaPledgesPanel'
import { PlazaStrategyCard } from '@/components/campaign/PlazaStrategyCard'
import { PlazaTabNav } from '@/components/campaign/PlazaTabNav'
import { PlazaUpdateFeed } from '@/components/campaign/PlazaUpdateFeed'
import { PlazaUpdateForm } from '@/components/campaign/PlazaUpdateForm'
import { PlazaZoneNeighborhoodsCard } from '@/components/campaign/PlazaZoneNeighborhoodsCard'
import { RecentVisitTracker } from '@/components/campaign/RecentVisitTracker'
import { Badge } from '@/components/ui/Badge'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadPlazaLeaderships } from '@/utilities/leadershipData'
import {
  loadPlazaCandidateComparison,
  MAX_COMPARISON_CANDIDATES,
} from '@/utilities/plazaCandidateComparison'
import { resolvePlazaDetailTab, type PlazaDetailSearchParams } from '@/utilities/plazaDetailTabUi'
import { plazaElectionGeographyForSlug } from '@/utilities/plazaElectionGeography'
import { loadPlazaElectoralBaseline } from '@/utilities/plazaElectoralBaseline'
import {
  getPlazaDetailViewModel,
  PlazaNotFoundError,
  resolveAccessiblePlazaContext,
} from '@/utilities/plazaPageData'
import { formatPlazaGeographyLabel, plazaKindLabels } from '@/utilities/plazaUi'
import { loadPlazaUpdatesFeed, parsePlazaUpdateFeedParams } from '@/utilities/plazaUpdatePageData'
import { loadAdvisorSummaries } from '@/utilities/plazaViewModels'
import {
  aggregatePlazaPledgesFromRows,
  loadLeaderPledges,
  loadPlazaPledges,
  toPlazaPledgeCoverageView,
} from '@/utilities/votePledgeData'
import { declareVotesFormAction, estimateVotesFormAction } from './pledgeFormActions'
import { createPlazaUpdateFormAction } from './updateFormActions'

type PlazaDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<PlazaDetailSearchParams>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

export default async function PlazaDetailPage({ params, searchParams }: PlazaDetailPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams])
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')

  let context
  try {
    context = await resolveAccessiblePlazaContext(payload, user, slug)
  } catch (error) {
    if (error instanceof PlazaNotFoundError) notFound()
    throw error
  }

  const isStaffView = isCampaignStaff(user)
  const roleKind = isStaffView ? 'staff' : 'leader'
  const activeTab = resolvePlazaDetailTab(rawSearchParams, roleKind)
  const view = await getPlazaDetailViewModel(payload, context, user)

  const advisorSummaries = await loadAdvisorSummaries(payload, user, view.advisorIDs)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{view.name}</h1>
          <Badge variant="scope">{plazaKindLabels[view.kind]}</Badge>
        </div>
        <p className="text-muted-foreground">{formatPlazaGeographyLabel(view)}</p>
        <p className="text-sm text-muted-foreground">
          {advisorSummaries.length
            ? `Assessoria: ${advisorSummaries.map((advisor) => advisor.name).join(', ')}`
            : 'Sem assessor designado.'}
          {view.lastUpdateAt
            ? ` · Última atualização em ${dateFormatter.format(new Date(view.lastUpdateAt))}`
            : ''}
        </p>
      </header>

      <PlazaTabNav
        activeTab={activeTab}
        plazaSlug={view.slug}
        searchParams={rawSearchParams}
        roleKind={roleKind}
      />

      {activeTab === 'overview' ? (
        <OverviewTab view={view} isStaffView={isStaffView} payloadUser={{ payload, user }} />
      ) : null}

      {activeTab === 'elections' ? (
        <ElectionsTab
          slug={view.slug}
          rawSearchParams={rawSearchParams}
          payloadUser={{ payload, user }}
        />
      ) : null}

      {activeTab === 'leaderships' && isStaffView ? (
        <LeadershipsTab plazaID={view.id} payloadUser={{ payload, user }} />
      ) : null}

      {activeTab === 'updates' ? (
        <UpdatesTab
          plazaID={view.id}
          plazaSlug={view.slug}
          rawSearchParams={rawSearchParams}
          payloadUser={{ payload, user }}
        />
      ) : null}

      {activeTab === 'demands' ? (
        <section className="rounded-xl border px-4 py-6">
          <p className="text-sm text-muted-foreground">
            As demandas desta Praça aparecem em{' '}
            <Link
              href="/campanha/demandas"
              className="text-primary underline-offset-4 hover:underline"
            >
              Demandas
            </Link>
            .
          </p>
        </section>
      ) : null}

      <RecentVisitTracker
        entry={{ href: `/campanha/pracas/${view.slug}`, label: view.name, kind: 'plaza' }}
      />
    </CampaignPageShell>
  )
}

type PayloadUser = {
  payload: Awaited<ReturnType<typeof getPayload>>
  user: NonNullable<Awaited<ReturnType<typeof getCampaignUser>>>
}

const OverviewTab = async ({
  view,
  isStaffView,
  payloadUser: { payload, user },
}: {
  view: Awaited<ReturnType<typeof getPlazaDetailViewModel>>
  isStaffView: boolean
  payloadUser: PayloadUser
}) => {
  const zoneNeighborhoodsCard =
    view.kind === 'zona' ? <PlazaZoneNeighborhoodsCard plazaSlug={view.slug} /> : null

  if (isStaffView && view.strategy) {
    const pledges = await loadPlazaPledges(payload, user, view.id)
    const pledgeCoverage = toPlazaPledgeCoverageView(aggregatePlazaPledgesFromRows(pledges))
    return (
      <div className="flex flex-col gap-6">
        {zoneNeighborhoodsCard}
        <PlazaStrategyCard
          strategy={view.strategy}
          plazaSlug={view.slug}
          canEdit
          pledgeCoverage={pledgeCoverage}
        />
        <PlazaPledgesPanel pledges={pledges} estimateFormAction={estimateVotesFormAction} />
      </div>
    )
  }

  const leaderPledges = await loadLeaderPledges(payload, user)
  const ownPledge = leaderPledges.find((pledge) => pledge.plazaID === view.id) ?? null

  return (
    <div className="flex flex-col gap-6">
      {zoneNeighborhoodsCard}
      <section className="flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">Seus votos nesta Praça</h2>
          <p className="text-sm text-muted-foreground">
            Informe quantos votos você está trazendo. Você pode atualizar o número quando quiser.
          </p>
        </div>
        <DeclareVotesForm
          plazaID={view.id}
          currentDeclaredVotes={ownPledge?.declaredVotes ?? null}
          formAction={declareVotesFormAction}
        />
      </section>
    </div>
  )
}

const ElectionsTab = async ({
  slug,
  rawSearchParams,
  payloadUser: { payload, user },
}: {
  slug: string
  rawSearchParams: PlazaDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const geography = plazaElectionGeographyForSlug(slug)
  const rawCompare = rawSearchParams.compare
  const compareNumbers = [
    ...new Set(
      (Array.isArray(rawCompare) ? rawCompare : rawCompare ? [rawCompare] : [])
        .filter((value) => /^[1-9]\d*$/.test(value))
        .map(Number),
    ),
  ].slice(0, MAX_COMPARISON_CANDIDATES)

  const [baseline, comparisonRows, candidateOptions] = await Promise.all([
    geography ? loadPlazaElectoralBaseline(payload, user, geography) : null,
    geography
      ? loadPlazaCandidateComparison(payload, user, geography, compareNumbers)
      : ([] as Awaited<ReturnType<typeof loadPlazaCandidateComparison>>),
    loadFederalCandidateOptions(payload, user),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PlazaBaselineCard baseline={baseline} />
      <section
        aria-labelledby="plaza-comparison-title"
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="plaza-comparison-title" className="text-base font-medium">
            Comparativo entre candidatos
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare a votação de deputados federais nesta Praça através dos anos (fonte TSE, votos
            nominais do 1º turno).
          </p>
        </div>
        <CandidateComparePicker
          options={candidateOptions}
          selectedNumbers={compareNumbers}
          maxSelected={MAX_COMPARISON_CANDIDATES}
        />
        {comparisonRows.length ? <PlazaCandidateComparisonTable rows={comparisonRows} /> : null}
      </section>
    </div>
  )
}

const LeadershipsTab = async ({
  plazaID,
  payloadUser: { payload, user },
}: {
  plazaID: number
  payloadUser: PayloadUser
}) => {
  const [leaderships, pledges] = await Promise.all([
    loadPlazaLeaderships(payload, user, plazaID),
    loadPlazaPledges(payload, user, plazaID),
  ])

  return (
    <PlazaLeadershipsPanel
      plazaID={plazaID}
      leaderships={leaderships}
      pledges={pledges}
      declareFormAction={declareVotesFormAction}
    />
  )
}

const UpdatesTab = async ({
  plazaID,
  plazaSlug,
  rawSearchParams,
  payloadUser: { payload, user },
}: {
  plazaID: number
  plazaSlug: string
  rawSearchParams: PlazaDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const feedState = parsePlazaUpdateFeedParams(rawSearchParams)
  const feed = await loadPlazaUpdatesFeed(payload, user, plazaID, feedState)

  return (
    <div className="flex flex-col gap-6">
      <PlazaUpdateForm plazaID={plazaID} formAction={createPlazaUpdateFormAction} />
      <PlazaUpdateFeed updates={feed.updates} />
      <CampaignListPagination
        page={feed.page}
        totalPages={feed.totalPages}
        hrefForPage={(page) =>
          `/campanha/pracas/${plazaSlug}?tab=updates${feedState.kind ? `&updateKind=${feedState.kind}` : ''}&updatePage=${page}`
        }
      />
    </div>
  )
}
