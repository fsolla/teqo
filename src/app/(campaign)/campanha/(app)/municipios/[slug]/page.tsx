import config from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Suspense } from 'react'

import { RecentVisitTracker } from '@/components/campaign/dashboard/RecentVisitTracker'
import { MunicipalityTabNav } from '@/components/campaign/municipality/MunicipalityTabNav'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { isCitySlug, salvadorCity } from '@/lib/salvadorCity'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  cityMunicipalityDetailTabs,
  resolveMunicipalityDetailTab,
  type MunicipalityDetailSearchParams,
} from '@/utilities/municipality/municipalityDetailTabUi'
import { formatMunicipalityGeographyLabel } from '@/utilities/municipality/municipalityLabels'
import {
  getMunicipalityDetailViewModel,
  MunicipalityNotFoundError,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { loadAdvisorSummaries } from '@/utilities/municipality/municipalityViewModels'

import { CityDemandsTab, CityOverviewTab } from './CityDetailSections'
import {
  DossierTab,
  ElectionsTab,
  LeadershipsTab,
  MunicipalityTabFallback,
  OverviewTab,
  UpdatesTab,
} from './MunicipalityDetailTabs'

const CITY_PAGE_SUBTITLE = 'Metropolitano de Salvador · ZE 1–19 · capital (agregado das 19 zonas)'

export async function generateMetadata({ params }: MunicipalityDetailPageProps) {
  const { slug } = await params
  // Same gate as the page itself: the city metadata is staff-only too.
  const user = await requireCampaignPageActor({ gate: 'noLeader' })
  if (isCitySlug(slug)) {
    return campaignPageMetadata({ title: salvadorCity.name, subtitle: CITY_PAGE_SUBTITLE })
  }
  const payload = await getPayload({ config })

  try {
    const context = await resolveAccessibleMunicipalityContext(payload, user, slug)
    const view = await getMunicipalityDetailViewModel(payload, context, user)
    return campaignPageMetadata({
      title: view.name,
      subtitle: formatMunicipalityGeographyLabel(view),
    })
  } catch {
    return campaignPageMetadata({ title: 'Município' })
  }
}

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

  // B178 — the virtual Salvador city has no DB document: the page is a
  // read-only aggregate over the 19 zones, with its own reduced tab set.
  if (isCitySlug(slug)) {
    const resolvedTab = resolveMunicipalityDetailTab(rawSearchParams)
    const cityTab = cityMunicipalityDetailTabs.includes(resolvedTab) ? resolvedTab : 'overview'
    return (
      <CampaignPageShell>
        <SetCampaignPageChrome
          chrome={{ title: salvadorCity.name, subtitle: CITY_PAGE_SUBTITLE }}
        />
        <MunicipalityTabNav
          activeTab={cityTab}
          municipalitySlug={salvadorCity.slug}
          searchParams={rawSearchParams}
          tabs={cityMunicipalityDetailTabs}
          ariaLabel="Seções da capital"
        />
        {cityTab === 'overview' ? <CityOverviewTab payload={payload} user={user} /> : null}
        {cityTab === 'elections' ? (
          <Suspense fallback={<MunicipalityTabFallback />}>
            <ElectionsTab
              slug={salvadorCity.slug}
              rawSearchParams={rawSearchParams}
              payloadUser={{ payload, user }}
            />
          </Suspense>
        ) : null}
        {cityTab === 'demands' ? <CityDemandsTab /> : null}
        <RecentVisitTracker
          entry={{
            href: `/campanha/municipios/${salvadorCity.slug}`,
            label: salvadorCity.name,
            kind: 'municipality',
          }}
        />
      </CampaignPageShell>
    )
  }

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
      <SetCampaignPageChrome
        chrome={{
          title: view.name,
          subtitle: formatMunicipalityGeographyLabel(view),
        }}
      />

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
