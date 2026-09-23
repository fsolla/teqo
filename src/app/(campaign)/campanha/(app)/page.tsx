import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeCardDownloads } from '@/components/campaign/dashboard/CampaignHomeCardDownloads'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeStaffChrome } from '@/components/campaign/dashboard/CampaignHomeStaffChrome'
import { CampaignHomeSummary } from '@/components/campaign/dashboard/CampaignHomeSummary'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { advisorEditingScope, type AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { UNCOVERED_MUNICIPALITIES_LIST_HREF } from '@/lib/campaignHomeActions'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_HOME } from '@/lib/campaignPaths'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { loadCampaignHomeSummary } from '@/utilities/campaignDashboardData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadHomeSearchSuggestions } from '@/utilities/homeSearch/loadHomeSearchSuggestions'

export const dynamic = 'force-dynamic'

export const metadata = campaignPageMetadata(null)

export default async function CampaignHomePage() {
  const [payload, user] = await Promise.all([getPayload({ config }), requireCampaignPageActor()])

  // C154 — the communicator's home is the communication vertical; the login
  // lands on `/campanha`, so this is where the redirect happens.
  if (user.role === 'communicator') redirect(CAMPAIGN_COMMUNICATION_HOME)

  const staff = isStaffCampaignRole(user.role)

  // C142 — the write scope filters the home actions for advisors.
  const editingScope: AdvisorEditingScope =
    user.role === 'advisor' ? advisorEditingScope(user.visibility, user.editing) : 'tudo'

  const uncoveredMunicipalitiesHref = staff ? UNCOVERED_MUNICIPALITIES_LIST_HREF : undefined

  const actions = (
    <CampaignHomeActions
      role={user.role}
      editingScope={editingScope}
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
    summarySlot = (
      <>
        <CampaignHomeSummary view={summaryView} />
        <CampaignHomeCardDownloads view={summaryView.cardDownloads} />
      </>
    )
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
