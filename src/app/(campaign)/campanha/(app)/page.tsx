import config from '@payload-config'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeStaffChrome } from '@/components/campaign/dashboard/CampaignHomeStaffChrome'
import { CampaignHomeSummary } from '@/components/campaign/dashboard/CampaignHomeSummary'
import { HomeSearchMunicipalityGroup } from '@/components/campaign/dashboard/HomeSearchMunicipalityGroup'
import { HomeSearchResultsShell } from '@/components/campaign/dashboard/HomeSearchResultsShell'
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
    <CampaignPageShell aria-label="Início" className="min-h-full">
      {staff ? (
        <CampaignHomeStaffChrome
          actions={actions}
          searchResults={
            <HomeSearchResultsShell>
              <HomeSearchMunicipalityGroup />
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
