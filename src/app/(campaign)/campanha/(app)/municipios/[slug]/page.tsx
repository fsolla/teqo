import config from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Suspense } from 'react'

import { RecentVisitTracker } from '@/components/campaign/dashboard/RecentVisitTracker'
import { MunicipalityDetailHeaderView } from '@/components/campaign/municipality/MunicipalityDetailHeaderView'
import { MunicipalityDetailLocal } from '@/components/campaign/municipality/MunicipalityDetailLocal'
import { MunicipalityTabNav } from '@/components/campaign/municipality/MunicipalityTabNav'
import { OfflineBoundary } from '@/components/campaign/opsSync/OfflineBoundary'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { toDetailHeaderView } from '@/lib/campaignOps/municipalityDetailHeaderView'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  resolveMunicipalityDetailTab,
  type MunicipalityDetailSearchParams,
} from '@/utilities/municipality/municipalityDetailTabUi'
import {
  getMunicipalityDetailViewModel,
  MunicipalityNotFoundError,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { loadAdvisorSummaries } from '@/utilities/municipality/municipalityViewModels'

import {
  DossierTab,
  ElectionsTab,
  LeadershipsTab,
  MunicipalityTabFallback,
  OverviewTab,
  UpdatesTab,
} from './MunicipalityDetailTabs'

type MunicipalityDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<MunicipalityDetailSearchParams>
}

export default async function MunicipalityDetailPage({
  params,
  searchParams,
}: MunicipalityDetailPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams])
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'noLeader' }),
    getPayload({ config }),
  ])

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
  const headerView = toDetailHeaderView({
    name: view.name,
    kind: view.kind,
    region: view.region,
    zoneNumber: view.zoneNumber,
    lastUpdateAt: view.lastUpdateAt,
  })

  return (
    <CampaignPageShell>
      <OfflineBoundary fallback={<MunicipalityDetailLocal slug={slug} />}>
        {/* print: the dossier tab carries its own capa; page chrome stays out. */}
        <MunicipalityDetailHeaderView view={headerView} advisorSummaries={advisorSummaries} />

        <MunicipalityTabNav
          activeTab={activeTab}
          municipalitySlug={view.slug}
          searchParams={rawSearchParams}
        />

        {activeTab === 'overview' ? (
          <OverviewTab view={view} payloadUser={{ payload, user }} />
        ) : null}

        {activeTab === 'dossie' ? (
          // Composes every vertical of the município in one read — streams like
          // the elections tab since it includes the same TSE baseline read.
          <Suspense fallback={<MunicipalityTabFallback />}>
            <DossierTab
              view={view}
              advisorSummaries={advisorSummaries}
              payloadUser={{ payload, user }}
            />
          </Suspense>
        ) : null}

        {activeTab === 'elections' ? (
          // Streams below the header/tab chrome — the TSE baselines and the
          // comparison table are the slowest reads on this page.
          <Suspense fallback={<MunicipalityTabFallback />}>
            <ElectionsTab
              slug={view.slug}
              rawSearchParams={rawSearchParams}
              payloadUser={{ payload, user }}
            />
          </Suspense>
        ) : null}

        {activeTab === 'leaderships' ? (
          <Suspense fallback={<MunicipalityTabFallback />}>
            <LeadershipsTab municipalityID={view.id} payloadUser={{ payload, user }} />
          </Suspense>
        ) : null}

        {activeTab === 'updates' ? (
          <Suspense fallback={<MunicipalityTabFallback />}>
            <UpdatesTab
              municipalityID={view.id}
              municipalitySlug={view.slug}
              rawSearchParams={rawSearchParams}
              payloadUser={{ payload, user }}
            />
          </Suspense>
        ) : null}

        {activeTab === 'demands' ? (
          <section className="rounded-xl border px-4 py-6">
            <p className="text-sm text-muted-foreground">
              As demandas deste município aparecem em{' '}
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
      </OfflineBoundary>
    </CampaignPageShell>
  )
}
