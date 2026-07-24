import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignDashboard } from '@/components/campaign/CampaignDashboard'
import { LeaderContactsPanel } from '@/components/campaign/LeaderContactsPanel'
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
  const [view, mapBundle, candidateOptions] = await Promise.all([
    getCampaignDashboardData(payload, user),
    isStaff
      ? loadMunicipalityMapBundle(payload, user, { compare: rawSearchParams.compare })
      : Promise.resolve(null),
    isStaff ? loadFederalCandidateOptions(user) : Promise.resolve([]),
  ])

  return (
    <CampaignDashboard
      view={view}
      userName={user.name}
      mapBundle={mapBundle}
      candidateOptions={candidateOptions}
    />
  )
}
