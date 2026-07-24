import config from '@payload-config'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CandidateComparePicker } from '@/components/campaign/CandidateComparePicker'
import { MunicipalityBaselineCard } from '@/components/campaign/MunicipalityBaselineCard'
import { MunicipalityCandidateComparisonTable } from '@/components/campaign/MunicipalityCandidateComparisonTable'
import { MunicipalityLeadershipsPanel } from '@/components/campaign/MunicipalityLeadershipsPanel'
import { MunicipalityPledgesPanel } from '@/components/campaign/MunicipalityPledgesPanel'
import { MunicipalityStrategyCard } from '@/components/campaign/MunicipalityStrategyCard'
import { MunicipalityTabNav } from '@/components/campaign/MunicipalityTabNav'
import { MunicipalityUpdateFeed } from '@/components/campaign/MunicipalityUpdateFeed'
import { MunicipalityUpdateForm } from '@/components/campaign/MunicipalityUpdateForm'
import { MunicipalityZoneNeighborhoodsCard } from '@/components/campaign/MunicipalityZoneNeighborhoodsCard'
import { RecentVisitTracker } from '@/components/campaign/RecentVisitTracker'
import { Badge } from '@/components/ui/Badge'
import { isCampaignLeader } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadMunicipalityLeaderships } from '@/utilities/leadershipData'
import {
  loadMunicipalityCandidateComparison,
  MAX_COMPARISON_CANDIDATES,
} from '@/utilities/municipalityCandidateComparison'
import {
  resolveMunicipalityDetailTab,
  type MunicipalityDetailSearchParams,
} from '@/utilities/municipalityDetailTabUi'
import { municipalityElectionGeographyForSlug } from '@/utilities/municipalityElectionGeography'
import { loadMunicipalityElectoralBaseline } from '@/utilities/municipalityElectoralBaseline'
import {
  getMunicipalityDetailViewModel,
  MunicipalityNotFoundError,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipalityPageData'
import {
  formatMunicipalityGeographyLabel,
  municipalityKindLabels,
} from '@/utilities/municipalityUi'
import {
  loadMunicipalityUpdatesFeed,
  parseMunicipalityUpdateFeedParams,
} from '@/utilities/municipalityUpdatePageData'
import { loadAdvisorSummaries } from '@/utilities/municipalityViewModels'
import {
  aggregateMunicipalityPledgesFromRows,
  loadMunicipalityPledges,
  toMunicipalityPledgeCoverageView,
} from '@/utilities/votePledgeData'
import { declareVotesFormAction, estimateVotesFormAction } from './pledgeFormActions'
import { createMunicipalityUpdateFormAction } from './updateFormActions'

type MunicipalityDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<MunicipalityDetailSearchParams>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

export default async function MunicipalityDetailPage({
  params,
  searchParams,
}: MunicipalityDetailPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams])
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (isCampaignLeader(user)) redirect('/campanha')

  let context
  try {
    context = await resolveAccessibleMunicipalityContext(payload, user, slug)
  } catch (error) {
    if (error instanceof MunicipalityNotFoundError) notFound()
    throw error
  }

  const activeTab = resolveMunicipalityDetailTab(rawSearchParams)
  const view = await getMunicipalityDetailViewModel(payload, context, user)

  const advisorSummaries = await loadAdvisorSummaries(payload, user, view.advisorIDs)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{view.name}</h1>
          <Badge variant="scope">{municipalityKindLabels[view.kind]}</Badge>
        </div>
        <p className="text-muted-foreground">{formatMunicipalityGeographyLabel(view)}</p>
        <p className="text-sm text-muted-foreground">
          {advisorSummaries.length
            ? `Assessoria: ${advisorSummaries.map((advisor) => advisor.name).join(', ')}`
            : 'Sem assessor designado.'}
          {view.lastUpdateAt
            ? ` · Última atualização em ${dateFormatter.format(new Date(view.lastUpdateAt))}`
            : ''}
        </p>
      </header>

      <MunicipalityTabNav
        activeTab={activeTab}
        municipalitySlug={view.slug}
        searchParams={rawSearchParams}
      />

      {activeTab === 'overview' ? (
        <OverviewTab view={view} payloadUser={{ payload, user }} />
      ) : null}

      {activeTab === 'elections' ? (
        <ElectionsTab
          slug={view.slug}
          rawSearchParams={rawSearchParams}
          payloadUser={{ payload, user }}
        />
      ) : null}

      {activeTab === 'leaderships' ? (
        <LeadershipsTab municipalityID={view.id} payloadUser={{ payload, user }} />
      ) : null}

      {activeTab === 'updates' ? (
        <UpdatesTab
          municipalityID={view.id}
          municipalitySlug={view.slug}
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
        entry={{
          href: `/campanha/municipios/${view.slug}`,
          label: view.name,
          kind: 'municipality',
        }}
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
  payloadUser: { payload, user },
}: {
  view: Awaited<ReturnType<typeof getMunicipalityDetailViewModel>>
  payloadUser: PayloadUser
}) => {
  const zoneNeighborhoodsCard =
    view.kind === 'zona' ? <MunicipalityZoneNeighborhoodsCard municipalitySlug={view.slug} /> : null

  const pledges = await loadMunicipalityPledges(payload, user, view.id)
  const pledgeCoverage = toMunicipalityPledgeCoverageView(
    aggregateMunicipalityPledgesFromRows(pledges),
  )

  return (
    <div className="flex flex-col gap-6">
      {zoneNeighborhoodsCard}
      {view.strategy ? (
        <MunicipalityStrategyCard
          strategy={view.strategy}
          municipalitySlug={view.slug}
          canEdit
          pledgeCoverage={pledgeCoverage}
        />
      ) : null}
      <MunicipalityPledgesPanel pledges={pledges} estimateFormAction={estimateVotesFormAction} />
    </div>
  )
}

const ElectionsTab = async ({
  slug,
  rawSearchParams,
  payloadUser: { payload, user },
}: {
  slug: string
  rawSearchParams: MunicipalityDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const geography = municipalityElectionGeographyForSlug(slug)
  const rawCompare = rawSearchParams.compare
  const compareNumbers = [
    ...new Set(
      (Array.isArray(rawCompare) ? rawCompare : rawCompare ? [rawCompare] : [])
        .filter((value) => /^[1-9]\d*$/.test(value))
        .map(Number),
    ),
  ].slice(0, MAX_COMPARISON_CANDIDATES)

  const [baseline, comparisonRows, candidateOptions] = await Promise.all([
    geography ? loadMunicipalityElectoralBaseline(payload, user, geography) : null,
    geography
      ? loadMunicipalityCandidateComparison(payload, user, geography, compareNumbers)
      : ([] as Awaited<ReturnType<typeof loadMunicipalityCandidateComparison>>),
    loadFederalCandidateOptions(payload, user),
  ])

  return (
    <div className="flex flex-col gap-6">
      <MunicipalityBaselineCard baseline={baseline} />
      <section
        aria-labelledby="municipality-comparison-title"
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="municipality-comparison-title" className="text-base font-medium">
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
        {comparisonRows.length ? (
          <MunicipalityCandidateComparisonTable rows={comparisonRows} />
        ) : null}
      </section>
    </div>
  )
}

const LeadershipsTab = async ({
  municipalityID,
  payloadUser: { payload, user },
}: {
  municipalityID: number
  payloadUser: PayloadUser
}) => {
  const [leaderships, pledges] = await Promise.all([
    loadMunicipalityLeaderships(payload, user, municipalityID),
    loadMunicipalityPledges(payload, user, municipalityID),
  ])

  return (
    <MunicipalityLeadershipsPanel
      municipalityID={municipalityID}
      leaderships={leaderships}
      pledges={pledges}
      declareFormAction={declareVotesFormAction}
    />
  )
}

const UpdatesTab = async ({
  municipalityID,
  municipalitySlug,
  rawSearchParams,
  payloadUser: { payload, user },
}: {
  municipalityID: number
  municipalitySlug: string
  rawSearchParams: MunicipalityDetailSearchParams
  payloadUser: PayloadUser
}) => {
  const feedState = parseMunicipalityUpdateFeedParams(rawSearchParams)
  const feed = await loadMunicipalityUpdatesFeed(payload, user, municipalityID, feedState)

  return (
    <div className="flex flex-col gap-6">
      <MunicipalityUpdateForm
        municipalityID={municipalityID}
        formAction={createMunicipalityUpdateFormAction}
      />
      <MunicipalityUpdateFeed updates={feed.updates} />
      <CampaignListPagination
        page={feed.page}
        totalPages={feed.totalPages}
        hrefForPage={(page) =>
          `/campanha/municipios/${municipalitySlug}?tab=updates${feedState.kind ? `&updateKind=${feedState.kind}` : ''}&updatePage=${page}`
        }
      />
    </div>
  )
}
