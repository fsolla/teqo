import config from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Suspense } from 'react'

import { RecentVisitTracker } from '@/components/campaign/dashboard/RecentVisitTracker'
import { MunicipalityTabNav } from '@/components/campaign/municipality/MunicipalityTabNav'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  resolveMunicipalityDetailTab,
  type MunicipalityDetailSearchParams,
} from '@/utilities/municipality/municipalityDetailTabUi'
import {
  formatMunicipalityGeographyLabel,
  municipalityKindLabels,
} from '@/utilities/municipality/municipalityLabels'
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

export const metadata = campaignPageMetadataFromCatalog('municipios')

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

  return (
    <CampaignPageShell>
      {/* print: the dossier tab carries its own capa; page chrome stays out. */}
      <header className="flex flex-col gap-2 print:hidden">
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
    </CampaignPageShell>
  )
}
