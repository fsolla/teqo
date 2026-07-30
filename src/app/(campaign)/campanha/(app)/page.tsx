import config from '@payload-config'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeStaffChrome } from '@/components/campaign/dashboard/CampaignHomeStaffChrome'
import { CampaignHomeSummary } from '@/components/campaign/dashboard/CampaignHomeSummary'
import { HomeSearchActivityGroup } from '@/components/campaign/dashboard/HomeSearchActivityGroup'
import { HomeSearchAdvisorGroup } from '@/components/campaign/dashboard/HomeSearchAdvisorGroup'
import { HomeSearchDemandGroup } from '@/components/campaign/dashboard/HomeSearchDemandGroup'
import { HomeSearchLeadershipGroup } from '@/components/campaign/dashboard/HomeSearchLeadershipGroup'
import { HomeSearchMunicipalityGroup } from '@/components/campaign/dashboard/HomeSearchMunicipalityGroup'
import { HomeSearchResultsLayout } from '@/components/campaign/dashboard/HomeSearchResultsLayout'
import { HomeSearchResultsShell } from '@/components/campaign/dashboard/HomeSearchResultsShell'
import { HomeSearchStateDeputyGroup } from '@/components/campaign/dashboard/HomeSearchStateDeputyGroup'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { loadCampaignHomeSummary } from '@/utilities/campaignDashboardData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildMunicipalityListHref } from '@/utilities/municipality/municipalityListUrl'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  const [payload, user] = await Promise.all([getPayload({ config }), requireCampaignPageActor()])

  const staff = isStaffCampaignRole(user.role)

  const uncoveredMunicipalitiesHref = staff
    ? buildMunicipalityListHref({ page: 1, coverage: 'sem_assessor', sort: 'votos' }, 1)
    : undefined

  const actions = (
    <CampaignHomeActions
      role={user.role}
      uncoveredMunicipalitiesHref={uncoveredMunicipalitiesHref}
    />
  )

  let summarySlot: ReactNode | undefined
  if (staff) {
    const summaryView = await loadCampaignHomeSummary(payload, user)
    summarySlot = <CampaignHomeSummary view={summaryView} />
  }

  return (
    <CampaignPageShell aria-label="Início" className="h-full min-h-0">
      {staff ? (
        <CampaignHomeStaffChrome
          actions={actions}
          searchResults={
            <HomeSearchResultsShell>
              <HomeSearchResultsLayout>
                <HomeSearchMunicipalityGroup />
                <HomeSearchLeadershipGroup />
                <HomeSearchAdvisorGroup />
                <HomeSearchActivityGroup />
                <HomeSearchStateDeputyGroup />
                <HomeSearchDemandGroup />
              </HomeSearchResultsLayout>
            </HomeSearchResultsShell>
          }
          summarySlot={summarySlot}
        />
      ) : (
        <CampaignHomeLayout actions={actions} />
      )}
    </CampaignPageShell>
  )
}
