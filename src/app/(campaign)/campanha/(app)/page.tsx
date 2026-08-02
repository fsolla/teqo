import config from '@payload-config'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeStaffChrome } from '@/components/campaign/dashboard/CampaignHomeStaffChrome'
import { CampaignHomeSummary } from '@/components/campaign/dashboard/CampaignHomeSummary'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { UNCOVERED_MUNICIPALITIES_LIST_HREF } from '@/lib/campaignHomeActions'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { loadCampaignHomeSummary } from '@/utilities/campaignDashboardData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadHomeSearchSuggestions } from '@/utilities/homeSearch/loadHomeSearchSuggestions'

export const dynamic = 'force-dynamic'

export const metadata = campaignPageMetadata(null)

export default async function CampaignHomePage() {
  const [payload, user] = await Promise.all([getPayload({ config }), requireCampaignPageActor()])

  const staff = isStaffCampaignRole(user.role)

  const uncoveredMunicipalitiesHref = staff ? UNCOVERED_MUNICIPALITIES_LIST_HREF : undefined

  const actions = (
    <CampaignHomeActions
      role={user.role}
      uncoveredMunicipalitiesHref={uncoveredMunicipalitiesHref}
    />
  )

  let summarySlot: ReactNode | undefined
  let initialSuggest: Awaited<ReturnType<typeof loadHomeSearchSuggestions>> | undefined
  if (staff) {
    const [summaryView, suggest] = await Promise.all([
      loadCampaignHomeSummary(payload, user),
      loadHomeSearchSuggestions(payload, user),
    ])
    summarySlot = <CampaignHomeSummary view={summaryView} />
    initialSuggest = suggest
  }

  return (
    <CampaignPageShell aria-label="Início" className="h-full min-h-0">
      {staff ? (
        <CampaignHomeStaffChrome
          actions={actions}
          initialSuggest={initialSuggest}
          summarySlot={summarySlot}
        />
      ) : (
        <CampaignHomeLayout actions={actions} />
      )}
    </CampaignPageShell>
  )
}
