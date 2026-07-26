import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { CampaignDashboard } from '@/components/campaign/dashboard/CampaignDashboard'
import { LeaderContactsPanel } from '@/components/campaign/leadership/LeaderContactsPanel'
import { MunicipalityMapPanelDynamic } from '@/components/campaign/map/MunicipalityMapPanelDynamic'
import { MunicipalityEstimateScenarioProvider } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import type { CampaignUser } from '@/payload-types'
import { isCampaignLeader, isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getCampaignDashboardData } from '@/utilities/campaignDashboardData'
import { loadFederalCandidateOptions } from '@/utilities/electionCandidateOptions'
import { loadLeaderContactsPageData } from '@/utilities/leaderContactsPageData'
import { loadMunicipalityMapBundle } from '@/utilities/municipalityMapData'

export const dynamic = 'force-dynamic'

type CampaignHomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CampaignHomePage({ searchParams }: CampaignHomePageProps) {
  const rawSearchParams = await searchParams
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) redirect('/campanha/login')

  if (isCampaignLeader(user)) {
    const view = await loadLeaderContactsPageData(payload, user)
    return (
      <LeaderContactsPanel
        userName={user.name}
        municipalityOptions={view.municipalityOptions}
        defaultMunicipalityId={view.defaultMunicipalityId}
        showMunicipalitySelect={view.showMunicipalitySelect}
        registrationConsentConfigured={view.registrationConsentConfigured}
        contacts={view.contacts}
      />
    )
  }

  const isStaff = isCampaignStaff(user)
  const view = await getCampaignDashboardData(payload, user)

  return (
    <CampaignDashboard
      view={view}
      userName={user.name}
      mapSlot={
        isStaff ? (
          // Streams after the KPI shell paints; the shared request-scoped
          // municipality scope is reused (React cache), not reloaded.
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-[420px] w-full animate-pulse rounded-xl border bg-muted/40"
              />
            }
          >
            <DashboardMapSection payload={payload} user={user} compare={rawSearchParams.compare} />
          </Suspense>
        ) : null
      }
    />
  )
}

const DashboardMapSection = async ({
  payload,
  user,
  compare,
}: {
  payload: Payload
  user: CampaignUser
  compare: string | string[] | undefined
}) => {
  const [mapBundle, candidateOptions] = await Promise.all([
    loadMunicipalityMapBundle(payload, user, { compare }),
    loadFederalCandidateOptions(user),
  ])
  if (!mapBundle) return null

  return (
    <MunicipalityEstimateScenarioProvider>
      <MunicipalityMapPanelDynamic bundle={mapBundle} candidateOptions={candidateOptions} />
    </MunicipalityEstimateScenarioProvider>
  )
}
